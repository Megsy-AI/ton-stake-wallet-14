CREATE TABLE public.tt_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  username text,
  first_name text,
  wallet_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tt_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  wallet_address text,
  coin text NOT NULL DEFAULT 'GRAM',
  amount numeric NOT NULL CHECK (amount > 0),
  ton_paid numeric NOT NULL DEFAULT 0,
  tier text NOT NULL,
  apy numeric NOT NULL,
  lock_days integer NOT NULL,
  tx_hash text,
  status text NOT NULL DEFAULT 'active',
  rewards_claimed numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tt_ai_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL,
  wallet_address text,
  deposit numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  pnl numeric NOT NULL DEFAULT 0,
  risk text NOT NULL DEFAULT 'balanced',
  status text NOT NULL DEFAULT 'idle',
  tx_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tt_ai_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.tt_ai_bots(id) ON DELETE CASCADE,
  telegram_id bigint NOT NULL,
  pair text NOT NULL,
  side text NOT NULL,
  size numeric NOT NULL,
  entry_price numeric NOT NULL,
  exit_price numeric,
  pnl numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX idx_tt_stakes_tg ON public.tt_stakes (telegram_id);
CREATE INDEX idx_tt_ai_bots_tg ON public.tt_ai_bots (telegram_id);
CREATE INDEX idx_tt_ai_trades_tg ON public.tt_ai_trades (telegram_id);

GRANT SELECT, INSERT, UPDATE ON public.tt_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tt_stakes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tt_ai_bots TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tt_ai_trades TO anon, authenticated;
GRANT ALL ON public.tt_users TO service_role;
GRANT ALL ON public.tt_stakes TO service_role;
GRANT ALL ON public.tt_ai_bots TO service_role;
GRANT ALL ON public.tt_ai_trades TO service_role;

ALTER TABLE public.tt_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_ai_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_ai_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_users open read" ON public.tt_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_users open insert" ON public.tt_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tt_users open update" ON public.tt_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tt_stakes open read" ON public.tt_stakes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_stakes open insert" ON public.tt_stakes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tt_stakes open update" ON public.tt_stakes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tt_ai_bots open read" ON public.tt_ai_bots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_ai_bots open insert" ON public.tt_ai_bots FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tt_ai_bots open update" ON public.tt_ai_bots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tt_ai_trades open read" ON public.tt_ai_trades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_ai_trades open insert" ON public.tt_ai_trades FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tt_ai_trades open update" ON public.tt_ai_trades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);