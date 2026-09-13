import { supabase } from "@/integrations/supabase/client";

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
  balance: number;
  pnl: number;
  risk: string;
  status: string;
  created_at: string;
};

export type TradeRow = {
  id: string;
  bot_id: string;
  pair: string;
  side: string;
  size: number;
  entry_price: number;
  exit_price: number | null;
  pnl: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

export async function upsertUser(user: {
  telegram_id: number;
  username?: string | undefined;
  first_name?: string | undefined;
  wallet_address?: string | null | undefined;
}) {
  await supabase
    .from("tt_users")
    .upsert(
      {
        telegram_id: user.telegram_id,
        username: user.username ?? null,
        first_name: user.first_name ?? null,
        ...(user.wallet_address ? { wallet_address: user.wallet_address } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" },
    )
    .select();
}

export async function listStakes(telegramId: number): Promise<StakeRow[]> {
  const { data } = await supabase
    .from("tt_stakes")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false });
  return (data ?? []) as StakeRow[];
}

export async function createStake(input: {
  telegram_id: number;
  wallet_address: string | null;
  coin: string;
  amount: number;
  tier: string;
  apy: number;
  lock_days: number;
  tx_hash: string | null;
}) {
  const ends = new Date(Date.now() + input.lock_days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("tt_stakes")
    .insert({
      telegram_id: input.telegram_id,
      wallet_address: input.wallet_address,
      coin: input.coin,
      amount: input.amount,
      ton_paid: input.amount,
      tier: input.tier,
      apy: input.apy,
      lock_days: input.lock_days,
      tx_hash: input.tx_hash,
      ends_at: ends,
    })
    .select()
    .single();
  if (error) throw error;
  return data as StakeRow;
}

export async function getBot(telegramId: number): Promise<BotRow | null> {
  const { data } = await supabase
    .from("tt_ai_bots")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BotRow) ?? null;
}

export async function createBot(input: {
  telegram_id: number;
  wallet_address: string | null;
  deposit: number;
  risk: string;
  tx_hash: string | null;
}) {
  const { data, error } = await supabase
    .from("tt_ai_bots")
    .insert({
      telegram_id: input.telegram_id,
      wallet_address: input.wallet_address,
      deposit: input.deposit,
      balance: input.deposit,
      risk: input.risk,
      tx_hash: input.tx_hash,
      status: "running",
    })
    .select()
    .single();
  if (error) throw error;
  return data as BotRow;
}

export async function listTrades(botId: string): Promise<TradeRow[]> {
  const { data } = await supabase
    .from("tt_ai_trades")
    .select("*")
    .eq("bot_id", botId)
    .order("opened_at", { ascending: false })
    .limit(20);
  return (data ?? []) as TradeRow[];
}

export async function claimStake(stake: StakeRow, rewards: number) {
  const { error } = await supabase
    .from("tt_stakes")
    .update({
      status: "completed",
      rewards_claimed: rewards,
    })
    .eq("id", stake.id);
  if (error) throw error;
}
