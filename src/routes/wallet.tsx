import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toast } from "sonner";
import { CoinIcon } from "@/components/CoinIcon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getMarkets } from "@/lib/ai-trading.functions";
import { getWalletBalance } from "@/lib/ton-trader.functions";
import { ASSETS, TREASURY_WALLET, formatNumber, shortAddress, toNano } from "@/lib/tt";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [
    { title: "Wallet — EGRAM" },
    { name: "description", content: "Your connected TON wallet balance and current asset prices." },
    { property: "og:title", content: "Wallet — EGRAM" },
    { property: "og:description", content: "Connected TON wallet balance and current asset prices." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: WalletPage,
});

type Market = { pair: string; price: number; change24h: number };

function WalletPage() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const fetchBalance = useServerFn(getWalletBalance);
  const fetchMarkets = useServerFn(getMarkets);
  const [balance, setBalance] = useState<number | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [deposit, setDeposit] = useState("");
  const [depositOpen, setDepositOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMarkets({}).then((result) => setMarkets(result.markets)).catch(() => undefined);
  }, [fetchMarkets]);

  useEffect(() => {
    if (!address) { setBalance(null); return; }
    fetchBalance({ data: { address } })
      .then((result) => setBalance(result.live ? result.balanceTon : null))
      .catch(() => setBalance(null));
  }, [address, fetchBalance]);

  const sendDeposit = async () => {
    const amount = Number(deposit);
    if (!address) { tonConnectUI.openModal(); return; }
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid TON amount"); return; }
    setBusy(true);
    try {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: TREASURY_WALLET, amount: toNano(amount) }],
      });
      setDepositOpen(false);
      setDeposit("");
      toast.success("Deposit submitted to TON network");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction cancelled");
    } finally { setBusy(false); }
  };

  const priceFor = (symbol: string) => {
    const pair = symbol === "GRAM" ? "TON/USDT" : symbol === "USDT" ? "USDT/USD" : `${symbol}/USDT`;
    return markets.find((market) => market.pair === pair);
  };

  return <main className="mx-auto w-full max-w-md px-5 pt-5">
    <header className="flex items-center justify-between">
      <h1 className="display-type text-[24px] font-semibold leading-none">Wallet</h1>
      <Button onClick={() => address ? tonConnectUI.disconnect() : tonConnectUI.openModal()} variant="outline" size="sm" className="tap-scale h-9 rounded-full bg-card px-4 text-[11px] font-semibold shadow-none">{address ? shortAddress(address) : "Connect"}</Button>
    </header>

    <section className="wallet-balance mt-5">
      <p className="text-[10px] font-semibold uppercase text-primary-foreground/50">Available balance</p>
      <div className="mt-2 flex items-end gap-2"><p className="display-type text-[42px] font-semibold leading-none">{address ? balance === null ? "—" : formatNumber(balance, 3) : "0"}</p><span className="pb-1 text-[13px] font-semibold text-primary-foreground/55">TON</span></div>
      <p className="mt-3 text-[11px] text-primary-foreground/50">{address ? shortAddress(address) : "Connect your TON wallet"}</p>
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
          <DialogTrigger asChild><Button className="tap-scale h-12 rounded-xl bg-primary-foreground text-primary shadow-none hover:bg-primary-foreground/90"><ArrowDownToLine />Deposit</Button></DialogTrigger>
          <DialogContent className="max-w-[calc(100%-40px)] rounded-2xl border-border p-5">
            <DialogHeader><DialogTitle className="display-type text-left text-[20px]">Deposit TON</DialogTitle></DialogHeader>
            <div className="mt-2 border-b border-border pb-3"><input autoFocus value={deposit} inputMode="decimal" onChange={(event) => setDeposit(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" className="display-type w-full bg-transparent text-[34px] font-semibold outline-none" /><span className="text-[11px] text-muted-foreground">TON</span></div>
            <Button onClick={sendDeposit} disabled={busy} className="mt-2 h-12 rounded-xl">{busy ? "Confirming" : address ? "Continue" : "Connect wallet"}</Button>
          </DialogContent>
        </Dialog>
        <Button asChild variant="secondary" className="tap-scale h-12 rounded-xl shadow-none"><a href="https://app.tonkeeper.com/" target="_blank" rel="noreferrer"><ArrowUpFromLine />Withdraw</a></Button>
      </div>
    </section>

    <section className="mt-8">
      <h2 className="display-type px-1 text-[18px] font-semibold">Assets</h2>
      <div className="mt-3 divide-y divide-border border-y border-border">
        {ASSETS.map((asset) => {
          const market = priceFor(asset.symbol);
          return <div key={asset.symbol} className="flex items-center justify-between py-3.5">
            <div className="flex items-center gap-3"><CoinIcon symbol={asset.symbol} className="h-9 w-9" /><div><p className="text-[13px] font-semibold">{asset.symbol}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{asset.name}</p></div></div>
            <div className="text-right"><p className="text-[13px] font-semibold">{market ? `$${formatNumber(market.price, market.price < 1 ? 4 : 2)}` : "—"}</p><p className={market && market.change24h >= 0 ? "mt-0.5 text-[10px] font-medium text-success" : "mt-0.5 text-[10px] font-medium text-muted-foreground"}>{market ? `${market.change24h >= 0 ? "+" : ""}${market.change24h.toFixed(2)}%` : "Unavailable"}</p></div>
          </div>;
        })}
      </div>
    </section>
  </main>;
}