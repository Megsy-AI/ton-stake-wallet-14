DROP POLICY IF EXISTS "tt_stakes open insert" ON public.tt_stakes;
DROP POLICY IF EXISTS "tt_stakes open update" ON public.tt_stakes;

REVOKE INSERT, UPDATE, DELETE ON public.tt_stakes FROM anon, authenticated;
GRANT SELECT ON public.tt_stakes TO anon, authenticated;
GRANT ALL ON public.tt_stakes TO service_role;

ALTER TABLE public.tt_ai_trades
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS actual_offer_amount numeric,
  ADD COLUMN IF NOT EXISTS actual_ask_amount numeric,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tt_wallet_ops_confirmed_tx_unique
  ON public.tt_wallet_ops (tx_hash)
  WHERE tx_hash IS NOT NULL AND status = 'confirmed';