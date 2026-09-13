import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { BOT_ACTIVATION_USD, createTradingBot, getMarkets, runAiCycle } from "@/lib/ai-trading.functions";
import { getBot, listConfirmedTrades, type BotRow, type TradeRow } from "@/lib/tt-data.functions";
import { getTelegramUserSync } from "@/lib/telegram-user";
import { getAgentWallet } from "@/lib/ton-trader.functions";
import { verifyPayment } from "@/lib/ton-verify.functions";
import { TREASURY_WALLET, formatNumber, paymentComment, shortAddress, toNano } from "@/lib/tt";

export const Route = createFileRoute("/trading")({
  head: () => ({ meta: [
    { title: "AI Trading — EGRAM" },
    { name: "description", content: "Activate and monitor the EGRAM automated TON trading agent with confirmed on-chain activity." },
    { property: "og:title", content: "AI Trading — EGRAM" },
    { property: "og:description", content: "Live market monitoring and confirmed automated TON trades." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: TradingPage,
});

const RISKS = ["conservative", "balanced", "aggressive"] as const;

function TradingPage() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const tgUser = useMemo(() => getTelegramUserSync(), []);
  const fetchMarkets = useServerFn(getMarkets);
  const fetchAgent = useServerFn(getAgentWallet);
  const fetchBot = useServerFn(getBot);
  const fetchTrades = useServerFn(listConfirmedTrades);
  const createBot = useServerFn(createTradingBot);
  const cycle = useServerFn(runAiCycle);
  const verify = useServerFn(verifyPayment);
  const [bot, setBot] = useState<BotRow | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [markets, setMarkets] = useState<{ pair: string; price: number; change24h: number }[]>([]);
  const [agent, setAgent] = useState<{ live: boolean; address: string | null; balanceTon: number } | null>(null);
  const [deposit, setDeposit] = useState("");
  const [risk, setRisk] = useState<(typeof RISKS)[number]>("balanced");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const nextBot = await fetchBot({ data: { telegramId: tgUser.id } });
    setBot(nextBot);
    setTrades(nextBot ? await fetchTrades({ data: { botId: nextBot.id } }) : []);
    const [marketResult, walletResult] = await Promise.all([fetchMarkets({}), fetchAgent({})]);
    setMarkets(marketResult.markets);
    setAgent(walletResult);
  }, [fetchAgent, fetchBot, fetchMarkets, fetchTrades, tgUser.id]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => {
    if (!bot || bot.status !== "running") return;
    const id = setInterval(() => { cycle({ data: { botId: bot.id } }).then(refresh).catch(() => undefined); }, 30_000);
    return () => clearInterval(id);
  }, [bot, cycle, refresh]);

  const tonPrice = markets.find((market) => market.pair === "TON/USDT")?.price ?? 0;
  const activationTon = tonPrice > 0 ? BOT_ACTIVATION_USD / tonPrice : 0;

  const activate = async () => {
    const value = Number(deposit) || 0;
    if (!address) { tonConnectUI.openModal(); return; }
    if (!tonPrice) { toast.error("Live TON price is unavailable. Please try again."); return; }
    if (value < activationTon) { toast.error(`Activation requires $${BOT_ACTIVATION_USD} in TON`); return; }
    setBusy(true);
    try {
      const created = await createBot({ data: { telegramId: tgUser.id, walletAddress: address, depositTon: value, risk, txHash: null } });
      await tonConnectUI.sendTransaction({ validUntil: Math.floor(Date.now() / 1000) + 300, messages: [{ address: TREASURY_WALLET, amount: toNano(value), payload: await paymentComment(created.id) }] });
      toast.success("Agent deposit submitted. Waiting for TON confirmation");
      void (async () => { for (let attempt = 0; attempt < 10; attempt++) { await new Promise((resolve) => setTimeout(resolve, 12_000)); const result = await verify({ data: { kind: "bot", refId: created.id, telegramId: tgUser.id, sender: address } }).catch(() => null); if (result?.verified) { toast.success("Agent activated on TON network"); await refresh(); return; } } })();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Transaction cancelled"); }
    finally { setBusy(false); }
  };

  return <main className="mx-auto w-full max-w-md px-5 pt-5">
    <header className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase text-muted-foreground">Automated execution</p><h1 className="display-type mt-1 text-[24px] font-semibold leading-none">AI Trading</h1></div><Button onClick={() => address ? tonConnectUI.disconnect() : tonConnectUI.openModal()} variant="outline" size="sm" className="tap-scale h-9 rounded-full bg-card px-4 text-[11px] font-semibold shadow-none">{address ? shortAddress(address) : "Connect"}</Button></header>

    <section className="graphite-card mt-5 p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] text-primary-foreground/50">AGENT WALLET</p><p className="display-type mt-2 text-[36px] font-semibold leading-none">{agent?.live ? formatNumber(agent.balanceTon, 3) : "—"}</p><p className="mt-2 text-[12px] text-primary-foreground/55">TON · live on-chain balance</p></div><span className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[10px] font-semibold">{bot?.verified ? bot.status : bot ? "confirming" : "inactive"}</span></div><div className="mt-7 grid grid-cols-2 border-t border-primary-foreground/10 pt-4"><div><p className="text-[9px] text-primary-foreground/45">WALLET</p><p className="mt-1 text-[12px] font-semibold">{shortAddress(agent?.address)}</p></div><div className="text-right"><p className="text-[9px] text-primary-foreground/45">CONFIRMED TRADES</p><p className="mt-1 text-[12px] font-semibold">{trades.length}</p></div></div></section>

    {!bot ? <section className="ios-card mt-5 p-4"><div className="flex items-end justify-between"><div><p className="text-[10px] font-semibold uppercase text-muted-foreground">One-time activation</p><p className="display-type mt-1 text-[28px] font-semibold">${BOT_ACTIVATION_USD}</p></div><p className="mb-1 text-[11px] text-muted-foreground">{activationTon ? `≈ ${formatNumber(activationTon, 3)} TON` : "Live quote unavailable"}</p></div><label htmlFor="agent-deposit" className="mt-5 block text-[10px] font-semibold uppercase text-muted-foreground">Deposit in TON</label><input id="agent-deposit" value={deposit} inputMode="decimal" onChange={(event) => setDeposit(event.target.value.replace(/[^0-9.]/g, ""))} placeholder={activationTon ? activationTon.toFixed(3) : ""} className="display-type mt-1 w-full border-b border-border bg-transparent pb-2 text-[30px] font-semibold outline-none" /><div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">{RISKS.map((item) => <Button key={item} variant="ghost" onClick={() => setRisk(item)} className={risk === item ? "h-8 rounded-lg bg-card px-1 text-[9px] font-semibold capitalize shadow-sm" : "h-8 rounded-lg px-1 text-[9px] font-semibold capitalize text-muted-foreground"}>{item}</Button>)}</div><Button onClick={activate} disabled={busy} className="tap-scale mt-3 h-12 w-full rounded-xl text-[13px] font-semibold shadow-none">{busy ? "Confirming" : address ? "Activate agent" : "Connect wallet"}</Button></section> : null}

    <section className="mt-7"><div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">How it works</h2><span className="text-[11px] text-muted-foreground">Live execution</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[["01","Scan","Live market momentum"],["02","Execute","STON.fi on TON"],["03","Verify","On-chain records only"]].map(([number,title,copy]) => <div key={number} className="process-step"><span className="text-[9px] font-semibold text-muted-foreground">{number}</span><p className="mt-3 text-[11px] font-semibold">{title}</p><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{copy}</p></div>)}</div></section>

    <section className="mt-7"><div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">Activity</h2><span className="text-[11px] text-muted-foreground">Confirmed only</span></div><div className="mt-2 divide-y divide-border border-y border-border">{trades.length ? trades.map((trade) => <div key={trade.id} className="flex items-center justify-between py-3"><div><p className="text-[12px] font-semibold">{trade.pair}</p><p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{trade.side} · {trade.status}</p></div><span className="text-[10px] font-semibold text-success">On-chain</span></div>) : <p className="py-6 text-center text-[11px] text-muted-foreground">No confirmed trades yet.</p>}</div></section>

    <section className="mt-7"><h2 className="display-type px-1 text-[18px] font-semibold">Questions</h2><Accordion type="single" collapsible className="mt-2 border-y border-border"><AccordionItem value="funds"><AccordionTrigger className="text-[12px] hover:no-underline">Where are funds held?</AccordionTrigger><AccordionContent className="text-[11px] leading-relaxed text-muted-foreground">Funds are assigned to the dedicated TON agent wallet. Its live balance is read directly from the network.</AccordionContent></AccordionItem><AccordionItem value="risk"><AccordionTrigger className="text-[12px] hover:no-underline">Can trading lose money?</AccordionTrigger><AccordionContent className="text-[11px] leading-relaxed text-muted-foreground">Yes. Automated trading carries market and smart-contract risk. Never deposit more than you can afford to lose.</AccordionContent></AccordionItem><AccordionItem value="proof"><AccordionTrigger className="text-[12px] hover:no-underline">Which results are shown?</AccordionTrigger><AccordionContent className="text-[11px] leading-relaxed text-muted-foreground">Only transactions with a network hash and confirmation time appear in activity.</AccordionContent></AccordionItem></Accordion></section>
  </main>;
}