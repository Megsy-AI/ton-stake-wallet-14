ALTER TABLE public.tt_stakes
  ADD COLUMN verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN sender_address text;

ALTER TABLE public.tt_ai_bots
  ADD COLUMN verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verified_at timestamptz;

CREATE TABLE public.tt_wallet_ops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint,
  kind text NOT NULL,
  ref_id uuid,
  sender_address text,
  amount numeric NOT NULL DEFAULT 0,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tt_wallet_ops_ref ON public.tt_wallet_ops (ref_id);

GRANT SELECT, INSERT, UPDATE ON public.tt_wallet_ops TO anon, authenticated;
GRANT ALL ON public.tt_wallet_ops TO service_role;

ALTER TABLE public.tt_wallet_ops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_wallet_ops open read" ON public.tt_wallet_ops FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_wallet_ops open insert" ON public.tt_wallet_ops FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "tt_wallet_ops open update" ON public.tt_wallet_ops FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);