import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const TREASURY = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";
const TONCENTER = "https://toncenter.com/api/v3";

function serverClient() {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

type Incoming = { source?: string | undefined; value: number; hash: string; utime: number };

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
      in_msg?: { source?: string; value?: string };
    }>;
  };
  return (json.transactions ?? [])
    .filter((t) => t.in_msg?.value)
    .map((t) => ({
      source: t.in_msg?.source,
      value: Number(t.in_msg?.value ?? 0) / 1e9,
      hash: t.hash,
      utime: t.now,
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
      amount: number;
      sender: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const table = data.kind === "stake" ? "tt_stakes" : "tt_ai_bots";

    let matched: Incoming | undefined;
    try {
      const incoming = await recentIncoming();
      const cutoff = Date.now() / 1000 - 60 * 60;
      matched = incoming.find(
        (tx) =>
          tx.utime >= cutoff &&
          tx.value >= data.amount * 0.98 &&
          (!data.sender || normalize(tx.source).endsWith(normalize(data.sender).slice(-12))),
      );
    } catch (err) {
      await supabase.from("tt_wallet_ops").insert({
        telegram_id: data.telegramId,
        kind: data.kind,
        ref_id: data.refId,
        sender_address: data.sender,
        amount: data.amount,
        status: "error",
        detail: { message: err instanceof Error ? err.message : "unknown" },
      });
      return { verified: false, reason: "network_error" };
    }

    if (!matched) {
      await supabase.from("tt_wallet_ops").insert({
        telegram_id: data.telegramId,
        kind: data.kind,
        ref_id: data.refId,
        sender_address: data.sender,
        amount: data.amount,
        status: "pending",
      });
      return { verified: false, reason: "not_found_yet" };
    }

    await supabase
      .from(table)
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        tx_hash: matched.hash,
        ...(data.kind === "stake" ? { sender_address: data.sender } : {}),
      })
      .eq("id", data.refId);

    await supabase.from("tt_wallet_ops").insert({
      telegram_id: data.telegramId,
      kind: data.kind,
      ref_id: data.refId,
      sender_address: data.sender,
      amount: matched.value,
      tx_hash: matched.hash,
      status: "confirmed",
    });

    return { verified: true, txHash: matched.hash };
  });
