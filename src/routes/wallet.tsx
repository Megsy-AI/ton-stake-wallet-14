import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowUpRight, Copy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CoinIcon } from "@/components/CoinIcon";
import {
  formatNumber,
  progressPct,
  shortAddress,
} from "@/lib/tt";
import { Button } from "@/components/ui/button";
import {
  listStakes,
  type StakeRow,
} from "@/lib/tt-data.functions";
import { getTelegramUserSync } from "@/lib/telegram-user";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — EGRAM" },
      {
        name: "description",
        content:
          "Track your TON wallet, active and past staking positions, and your AI trading bot performance.",
      },
      { property: "og:title", content: "Wallet — EGRAM" },
      {
        property: "og:description",
        content: "Staking history and AI trading performance in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const tgUser = useMemo(() => getTelegramUserSync(), []);

  const fetchStakes = useServerFn(listStakes);

  const [stakes, setStakes] = useState<StakeRow[]>([]);

  useEffect(() => {
    fetchStakes({ data: { telegramId: tgUser.id } }).then(setStakes).catch(() => undefined);
  }, [fetchStakes, tgUser.id]);

  const active = stakes.filter((stakeItem) => stakeItem.status === "active" && stakeItem.verified);
  const confirmed = stakes.filter((stakeItem) => stakeItem.verified);
  const total = active.reduce((sum, item) => sum + Number(item.ton_paid), 0);
  const projected = active.reduce((sum, item) => sum + Number(item.amount) * Number(item.apy) * Number(item.lock_days) / 36_500, 0);

    return (
    <main className="mx-auto w-full max-w-md px-5 pt-5">
      <header className="flex items-center justify-between">
        <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Your portfolio</p><h1 className="display-type mt-1 text-[24px] font-semibold leading-none">Wallet</h1></div>
        <Button onClick={() => (address ? tonConnectUI.disconnect() : tonConnectUI.openModal())} variant="outline" size="sm" className="tap-scale h-9 rounded-full bg-card px-4 text-[11px] font-semibold shadow-none">{address ? "Disconnect" : "Connect"}</Button>
      </header>

      <section className="graphite-card mt-5 p-5">
        <div className="flex items-start justify-between">
           <div><p className="text-[11px] font-medium text-primary-foreground/55">CONFIRMED STAKE</p><p className="display-type mt-2 text-[36px] font-semibold leading-none">{formatNumber(total)}</p><p className="mt-2 text-[12px] text-primary-foreground/55">TON across {active.length} active position{active.length === 1 ? "" : "s"}</p></div>
          {address ? <Button onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied"); }} variant="ghost" size="icon" className="tap-scale rounded-full bg-primary-foreground/10 text-primary-foreground" aria-label="Copy address"><Copy className="h-4 w-4" strokeWidth={1.7} /></Button> : null}
        </div>
        <div className="mt-7 grid grid-cols-2 border-t border-primary-foreground/10 pt-4"><div><p className="text-[10px] text-primary-foreground/45">CONNECTED WALLET</p><p className="mt-1 text-[13px] font-semibold">{shortAddress(address)}</p></div><div className="text-right"><p className="text-[10px] text-primary-foreground/45">PROJECTED REWARD</p><p className="mt-1 text-[13px] font-semibold text-accent">+{formatNumber(projected, 2)} TON</p></div></div>
      </section>

      <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card py-3 text-center"><div><p className="text-[9px] text-muted-foreground">ACTIVE</p><p className="mt-1 text-[13px] font-semibold">{active.length}</p></div><div><p className="text-[9px] text-muted-foreground">HISTORY</p><p className="mt-1 text-[13px] font-semibold">{confirmed.length}</p></div><div><p className="text-[9px] text-muted-foreground">NETWORK</p><p className="mt-1 text-[13px] font-semibold">TON</p></div></div>

      <section className="mt-7">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">Positions</h2><span className="text-[11px] text-muted-foreground">On-chain confirmed</span></div>
        {stakes.filter((s) => s.verified).length === 0 ? <div className="mt-2 border-y border-border py-7 text-center text-[12px] text-muted-foreground">No confirmed positions yet.</div> : <div className="mt-2 divide-y divide-border border-y border-border">{stakes.filter((s) => s.verified).map((s) => <div key={s.id} className="py-3.5"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><CoinIcon symbol={s.coin} className="h-8 w-8" /><div><p className="text-[13px] font-semibold">{s.coin === "GRAM" ? "GRAM (ex TON)" : s.coin}</p><p className="text-[10px] text-muted-foreground">{s.tier} · ends {new Date(s.ends_at).toLocaleDateString("en-US")}</p></div></div><div className="text-right"><p className="text-[14px] font-semibold">{formatNumber(Number(s.amount))} TON</p><p className="text-[10px] font-semibold text-success">{Number(s.apy)}% APY</p></div></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${progressPct(s.started_at, s.ends_at)}%` }} /></div></div>)}</div>}
      </section>

      <section className="mt-7"><Link to="/trading" className="community-link tap-scale"><div><p className="text-[13px] font-semibold">AI trading agent</p><p className="mt-1 text-[10px] text-muted-foreground">View live wallet, activation and confirmed trades</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} /></Link></section>
    </main>
  );
}
