DROP POLICY IF EXISTS "tt_ai_bots open insert" ON public.tt_ai_bots;
DROP POLICY IF EXISTS "tt_ai_bots open update" ON public.tt_ai_bots;
DROP POLICY IF EXISTS "tt_ai_trades open insert" ON public.tt_ai_trades;
DROP POLICY IF EXISTS "tt_ai_trades open update" ON public.tt_ai_trades;
DROP POLICY IF EXISTS "tt_wallet_ops open insert" ON public.tt_wallet_ops;
DROP POLICY IF EXISTS "tt_wallet_ops open update" ON public.tt_wallet_ops;

REVOKE INSERT, UPDATE, DELETE ON public.tt_ai_bots FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tt_ai_trades FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tt_wallet_ops FROM anon, authenticated;

GRANT SELECT ON public.tt_ai_bots TO anon, authenticated;
GRANT SELECT ON public.tt_ai_trades TO anon, authenticated;
GRANT SELECT ON public.tt_wallet_ops TO anon, authenticated;
GRANT ALL ON public.tt_ai_bots, public.tt_ai_trades, public.tt_wallet_ops TO service_role;