import { createServerFn } from "@tanstack/react-start";
import { Cell } from "@ton/core";
const TREASURY = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";
const TONCENTER = "https://toncenter.com/api/v3";

type Incoming = {
  source?: string | undefined;
  value: number;
  hash: string;
  utime: number;
  comment: string | null;
};

function readComment(body?: string): string | null {
  if (!body) return null;
  try {
    const slice = Cell.fromBase64(body).beginParse();
    if (slice.loadUint(32) !== 0) return null;
    return slice.loadStringTail();
  } catch {
    return null;
  }
}

/** Reads recent incoming transfers to the treasury wallet from the TON network. */
async function recentIncoming(): Promise<Incoming[]> {
  const key = process.env["TONCENTER_API_KEY"];
  const res = await fetch(`${TONCENTER}/transactions?account=${TREASURY}&limit=64&sort=desc`, {
    headers: key ? { "X-API-Key": key } : {},
  });
  if (!res.ok) throw new Error(`TON API error [${res.status}]: ${await res.text()}`);
  const json = (await res.json()) as {
    transactions?: Array<{
      hash: string;
      now: number;
      in_msg?: { source?: string; value?: string; message_content?: { body?: string } };
    }>;
  };
  return (json.transactions ?? [])
    .filter((t) => t.in_msg?.value)
    .map((t) => ({
      source: t.in_msg?.source,
      value: Number(t.in_msg?.value ?? 0) / 1e9,
      hash: t.hash,
      utime: t.now,
      comment: readComment(t.in_msg?.message_content?.body),
    }));
}

function normalize(address?: string | null): string {
  return (address ?? "").replace(/^0:/, "").slice(-48).toLowerCase();
}

/**
 * Confirms that a payment really landed on the treasury wallet, then flags the
 * staking position or the trading bot as verified.
 */
export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      kind: "stake" | "bot";
      refId: string;
      telegramId: number;
      sender: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = data.kind === "stake" ? "tt_stakes" : "tt_ai_bots";
    const { data: stakeReference } =
      data.kind === "stake"
        ? await supabaseAdmin
            .from("tt_stakes")
            .select("telegram_id, ton_paid, created_at")
            .eq("id", data.refId)
            .maybeSingle()
        : { data: null };
    const { data: botReference } =
      data.kind === "bot"
        ? await supabaseAdmin
            .from("tt_ai_bots")
            .select("telegram_id, deposit, created_at")
            .eq("id", data.refId)
            .maybeSingle()
        : { data: null };
    const reference = stakeReference ?? botReference;
    if (!reference || Number(reference.telegram_id) !== data.telegramId) {
      return { verified: false, reason: "invalid_reference" };
    }
    const expectedAmount = Number(stakeReference?.ton_paid ?? botReference?.deposit);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      return { verified: false, reason: "invalid_amount" };
    }
    if (data.kind === "bot") {
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd",
          { headers: { accept: "application/json" } },
        );
        const prices = (await res.json()) as { "the-open-network"?: { usd?: number } };
        const tonUsd = Number(prices["the-open-network"]?.usd);
        if (!res.ok || !Number.isFinite(tonUsd)) throw new Error("price_unavailable");
        if (expectedAmount * tonUsd < 497.5) {
          return { verified: false, reason: "insufficient_amount" };
        }
      } catch {
        return { verified: false, reason: "price_unavailable" };
      }
    }

    let matched: Incoming | undefined;
    try {
      const incoming = await recentIncoming();
      const cutoff = Date.now() / 1000 - 60 * 60;
      const referenceComment = `tt:${data.refId}`;
      matched = incoming.find(
        (tx) =>
          tx.utime >= cutoff &&
          Math.abs(tx.value - expectedAmount) <= 0.000001 &&
          tx.comment === referenceComment &&
          normalize(tx.source) === normalize(data.sender),
      );
    } catch (err) {
      await supabaseAdmin.from("tt_wallet_ops").insert({
        telegram_id: data.telegramId,
        kind: data.kind,
        ref_id: data.refId,
        sender_address: data.sender,
        amount: expectedAmount,
        status: "error",
        detail: { message: err instanceof Error ? err.message : "unknown" },
      });
      return { verified: false, reason: "network_error" };
    }

    if (!matched) {
      await supabaseAdmin.from("tt_wallet_ops").insert({
        telegram_id: data.telegramId,
        kind: data.kind,
        ref_id: data.refId,
        sender_address: data.sender,
        amount: expectedAmount,
        status: "pending",
      });
      return { verified: false, reason: "not_found_yet" };
    }

    const { data: reused } = await supabaseAdmin
      .from("tt_wallet_ops")
      .select("ref_id")
      .eq("tx_hash", matched.hash)
      .eq("status", "confirmed")
      .neq("ref_id", data.refId)
      .limit(1);
    if (reused?.length) return { verified: false, reason: "payment_already_used" };

    const { error: operationError } = await supabaseAdmin.from("tt_wallet_ops").insert({
      telegram_id: data.telegramId,
      kind: data.kind,
      ref_id: data.refId,
      sender_address: matched.source ?? data.sender,
      amount: matched.value,
      tx_hash: matched.hash,
      status: "confirmed",
      detail: { confirmation: "ton_network", reference: `tt:${data.refId}` },
    });
    if (operationError) return { verified: false, reason: "payment_already_used" };

    if (data.kind === "stake") {
      await supabaseAdmin
        .from("tt_stakes")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          tx_hash: matched.hash,
          sender_address: data.sender,
          status: "active",
        })
        .eq("id", data.refId);
    } else {
      await supabaseAdmin
        .from("tt_ai_bots")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          tx_hash: matched.hash,
          status: "running",
        })
        .eq("id", data.refId);
    }

    return { verified: true, txHash: matched.hash };
  });
