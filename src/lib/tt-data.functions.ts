import { createServerFn } from "@tanstack/react-start";
import { ASSETS, MIN_STAKE, tierForAmount } from "@/lib/tt";

export type StakeRow = {
  id: string;
  telegram_id: number;
  wallet_address: string | null;
  coin: string;
  amount: number;
  ton_paid: number;
  tier: string;
  apy: number;
  lock_days: number;
  tx_hash: string | null;
  status: string;
  verified: boolean;
  rewards_claimed: number;
  started_at: string;
  ends_at: string;
  created_at: string;
};

export type BotRow = {
  id: string;
  telegram_id: number;
  wallet_address: string | null;
  deposit: number;
  risk: string;
  status: string;
  verified: boolean;
  created_at: string;
};

export type TradeRow = {
  id: string;
  bot_id: string;
  pair: string;
  side: string;
  status: string;
  tx_hash: string;
  actual_offer_amount: number | null;
  actual_ask_amount: number | null;
  confirmed_at: string;
};

export const listStakes = createServerFn({ method: "GET" })
  .inputValidator((input: { telegramId: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tt_stakes")
      .select("id, telegram_id, wallet_address, coin, amount, ton_paid, tier, apy, lock_days, tx_hash, status, verified, rewards_claimed, started_at, ends_at, created_at")
      .eq("telegram_id", data.telegramId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not load staking positions");
    return (rows ?? []) as StakeRow[];
  });

export const createStakeIntent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { telegramId: number; walletAddress: string; coin: string; amount: number }) => input,
  )
  .handler(async ({ data }) => {
    if (!Number.isFinite(data.amount) || data.amount < MIN_STAKE) {
      throw new Error(`Minimum stake is ${MIN_STAKE} TON`);
    }
    if (!ASSETS.some((asset) => asset.symbol === data.coin)) {
      throw new Error("Unsupported staking asset");
    }
    const tier = tierForAmount(data.amount);
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + tier.lockDays * 86_400_000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tt_stakes")
      .insert({
        telegram_id: data.telegramId,
        wallet_address: data.walletAddress,
        coin: data.coin,
        amount: data.amount,
        ton_paid: data.amount,
        tier: tier.name,
        apy: tier.apy,
        lock_days: tier.lockDays,
        status: "pending",
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
        verified: false,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error("Could not prepare the staking payment");
    return { id: row.id };
  });

export const getBot = createServerFn({ method: "GET" })
  .inputValidator((input: { telegramId: number }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tt_ai_bots")
      .select("id, telegram_id, wallet_address, deposit, risk, status, verified, created_at")
      .eq("telegram_id", data.telegramId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error("Could not load the trading agent");
    return (row as BotRow | null) ?? null;
  });

export const listConfirmedTrades = createServerFn({ method: "GET" })
  .inputValidator((input: { botId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tt_ai_trades")
      .select("id, bot_id, pair, side, status, tx_hash, actual_offer_amount, actual_ask_amount, confirmed_at")
      .eq("bot_id", data.botId)
      .not("tx_hash", "is", null)
      .not("confirmed_at", "is", null)
      .order("confirmed_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Could not load confirmed trades");
    return (rows ?? []) as TradeRow[];
  });