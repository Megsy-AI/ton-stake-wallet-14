import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import gramCoin from "@/assets/gram.png.asset.json";
import { CoinIcon } from "@/components/CoinIcon";
import {
  TREASURY_WALLET,
  formatNumber,
  progressPct,
  shortAddress,
  toNano,
  paymentComment,
} from "@/lib/tt";
import { Button } from "@/components/ui/button";
import {
  getBot,
  listConfirmedTrades,
  listStakes,
  type BotRow,
  type StakeRow,
  type TradeRow,
} from "@/lib/tt-data.functions";
import {
  BOT_ACTIVATION_USD,
  createTradingBot,
  getMarkets,
  runAiCycle,
} from "@/lib/ai-trading.functions";
import { verifyPayment } from "@/lib/ton-verify.functions";
import { getAgentWallet } from "@/lib/ton-trader.functions";
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

const RISKS = ["conservative", "balanced", "aggressive"] as const;

function WalletPage() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const tgUser = useMemo(() => getTelegramUserSync(), []);

  const fetchMarkets = useServerFn(getMarkets);
  const cycle = useServerFn(runAiCycle);
  const verify = useServerFn(verifyPayment);
  const fetchAgent = useServerFn(getAgentWallet);
  const createBot = useServerFn(createTradingBot);
  const fetchStakes = useServerFn(listStakes);
  const fetchBot = useServerFn(getBot);
  const fetchTrades = useServerFn(listConfirmedTrades);

  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const [bot, setBot] = useState<BotRow | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [markets, setMarkets] = useState<{ pair: string; price: number; change24h: number }[]>([]);
  const [deposit, setDeposit] = useState("");
  const [risk, setRisk] = useState<string>("balanced");
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState<{
    live: boolean;
    address: string | null;
    balanceTon: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    const [s, b] = await Promise.all([
      fetchStakes({ data: { telegramId: tgUser.id } }),
      fetchBot({ data: { telegramId: tgUser.id } }),
    ]);
    setStakes(s);
    setBot(b);
    setTrades(b ? await fetchTrades({ data: { botId: b.id } }) : []);
  }, [tgUser.id, fetchStakes, fetchBot, fetchTrades]);

  useEffect(() => {
    refresh().catch(() => undefined);
    fetchMarkets({})
      .then((r) => setMarkets(r.markets))
      .catch(() => undefined);
    fetchAgent({})
      .then(setAgent)
      .catch(() => undefined);
  }, [refresh, fetchMarkets, fetchAgent]);

  useEffect(() => {
    if (!bot || bot.status !== "running") return;
    const tick = async () => {
      try {
        await cycle({ data: { botId: bot.id } });
        await refresh();
      } catch {
        /* market fetch can fail transiently */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [bot?.id, bot?.status, cycle, refresh]);

  const active = stakes.filter((stakeItem) => stakeItem.status === "active" && stakeItem.verified);
  const tonPrice = markets.find((market) => market.pair === "TON/USDT")?.price ?? 0;
  const activationTon = tonPrice > 0 ? BOT_ACTIVATION_USD / tonPrice : 0;

  const startBot = async () => {
    const value = Number(deposit) || 0;
    if (!address) {
      tonConnectUI.openModal();
      return;
    }
    if (!tonPrice) {
      toast.error("Live TON price is unavailable. Please try again.");
      return;
    }
    if (value < activationTon) {
      toast.error(`Activation requires $${BOT_ACTIVATION_USD} in TON`);
      return;
    }
    setBusy(true);
    try {
      const created = await createBot({
        data: {
          telegramId: tgUser.id,
          walletAddress: address,
          depositTon: value,
          risk: risk as (typeof RISKS)[number],
          txHash: null,
        },
      });
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
          address: TREASURY_WALLET,
          amount: toNano(value),
          payload: await paymentComment(created.id),
        }],
      });
      toast.success("Trading bot started. Confirming payment on TON network");
      await refresh();
      void (async () => {
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 12_000));
          try {
            const result = await verify({
              data: { kind: "bot", refId: created.id, telegramId: tgUser.id, sender: address },
            });
            if (result.verified) {
              toast.success("Deposit confirmed on TON network");
              await refresh();
              return;
            }
          } catch {
            /* retry */
          }
        }
      })();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction cancelled");
    } finally {
      setBusy(false);
    }
  };

    return (
    <main className="mx-auto w-full max-w-md px-5 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={gramCoin.url} alt="Gram token" width={38} height={38} className="h-9.5 w-9.5 rounded-full" />
          <div><p className="text-[10px] font-semibold uppercase text-muted-foreground">EGRAM</p><h1 className="display-type mt-0.5 text-[17px] font-semibold leading-none">Wallet</h1></div>
        </div>
        <Button onClick={() => (address ? tonConnectUI.disconnect() : tonConnectUI.openModal())} variant="outline" size="sm" className="tap-scale h-9 rounded-full bg-card px-4 text-[11px] font-semibold shadow-none">{address ? "Disconnect" : "Connect"}</Button>
      </header>

      <section className="graphite-card mt-5 p-5">
        <div className="flex items-start justify-between">
          <div><p className="text-[11px] font-medium text-primary-foreground/55">CONFIRMED STAKE</p><p className="display-type mt-2 text-[36px] font-semibold leading-none">{formatNumber(active.reduce((sum, item) => sum + Number(item.ton_paid), 0))}</p><p className="mt-2 text-[12px] text-primary-foreground/55">TON across {active.length} position{active.length === 1 ? "" : "s"}</p></div>
          {address ? <Button onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied"); }} variant="ghost" size="icon" className="tap-scale rounded-full bg-primary-foreground/10 text-primary-foreground" aria-label="Copy address"><Copy className="h-4 w-4" strokeWidth={1.7} /></Button> : null}
        </div>
        <div className="mt-7 border-t border-primary-foreground/10 pt-4"><p className="text-[10px] text-primary-foreground/45">CONNECTED WALLET</p><p className="mt-1 text-[13px] font-semibold">{shortAddress(address)}</p></div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">Positions</h2><span className="text-[11px] text-muted-foreground">On-chain confirmed</span></div>
        {stakes.filter((s) => s.verified).length === 0 ? <div className="mt-2 border-y border-border py-7 text-center text-[12px] text-muted-foreground">No confirmed positions yet.</div> : <div className="mt-2 divide-y divide-border border-y border-border">{stakes.filter((s) => s.verified).map((s) => <div key={s.id} className="py-3.5"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><CoinIcon symbol={s.coin} className="h-8 w-8" /><div><p className="text-[13px] font-semibold">{s.coin === "GRAM" ? "GRAM (ex TON)" : s.coin}</p><p className="text-[10px] text-muted-foreground">{s.tier} · ends {new Date(s.ends_at).toLocaleDateString("en-US")}</p></div></div><div className="text-right"><p className="text-[14px] font-semibold">{formatNumber(Number(s.amount))} TON</p><p className="text-[10px] font-semibold text-success">{Number(s.apy)}% APY</p></div></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-success" style={{ width: `${progressPct(s.started_at, s.ends_at)}%` }} /></div></div>)}</div>}
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">Market</h2><span className="text-[11px] text-muted-foreground">Live prices</span></div>
        <div className="mt-2 grid grid-cols-2 gap-2">{markets.slice(0, 4).map((market) => <div key={market.pair} className="rounded-xl border border-border bg-card p-3"><p className="text-[10px] font-semibold text-muted-foreground">{market.pair}</p><p className="display-type mt-2 text-[16px] font-semibold">${formatNumber(market.price, 4)}</p><p className={market.change24h >= 0 ? "mt-1 text-[10px] font-semibold text-success" : "mt-1 text-[10px] font-semibold text-destructive"}>{market.change24h >= 0 ? "+" : ""}{market.change24h.toFixed(2)}%</p></div>)}</div>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">AI trading</h2><span className="text-[11px] text-muted-foreground">Live agent</span></div>
        {bot ? <div className="ios-card mt-2 p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Agent wallet balance</p><p className="display-type mt-2 text-[26px] font-semibold">{agent?.live ? formatNumber(agent.balanceTon, 3) : "Unavailable"} <span className="text-[13px] text-muted-foreground">TON</span></p><p className="mt-1 text-[11px] text-muted-foreground">{agent?.live ? shortAddress(agent.address) : "Wallet unavailable"} · {bot.risk}</p></div><span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">{bot.verified ? bot.status : "confirming"}</span></div><div className="mt-4 border-t border-border pt-3">{trades.length === 0 ? <p className="text-[11px] text-muted-foreground">No confirmed trades yet.</p> : trades.map((trade) => <div key={trade.id} className="flex justify-between py-1 text-[11px]"><span>{trade.pair} · {trade.side}</span><span className="text-muted-foreground">confirmed</span></div>)}</div></div> : <div className="ios-card mt-2 p-4"><div className="flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Activation</p><p className="display-type mt-1 text-[28px] font-semibold">${BOT_ACTIVATION_USD}</p></div><p className="mb-1 text-[11px] text-muted-foreground">{activationTon > 0 ? `≈ ${formatNumber(activationTon, 3)} TON` : "Loading price"}</p></div><label className="mt-4 block text-[10px] font-semibold uppercase text-muted-foreground" htmlFor="deposit">Deposit in TON</label><input id="deposit" inputMode="decimal" value={deposit} placeholder={activationTon > 0 ? activationTon.toFixed(3) : ""} onChange={(e) => setDeposit(e.target.value.replace(/[^0-9.]/g, ""))} className="display-type mt-1 w-full border-b border-border bg-transparent pb-2 text-[28px] font-semibold outline-none" /><div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">{RISKS.map((item) => <Button key={item} onClick={() => setRisk(item)} variant="ghost" className={risk === item ? "h-8 rounded-lg bg-card text-[10px] font-semibold capitalize shadow-sm" : "h-8 rounded-lg text-[10px] font-semibold capitalize text-muted-foreground"}>{item}</Button>)}</div><Button onClick={startBot} disabled={busy} className="tap-scale mt-3 h-12 w-full rounded-xl text-[13px] font-semibold shadow-none">{busy ? "Confirming" : address ? `Activate for $${BOT_ACTIVATION_USD}` : "Connect wallet"}</Button><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Live market execution can produce losses. Only confirmed trades appear here.</p></div>}
      </section>
    </main>
  );
}
