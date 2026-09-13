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
      { title: "Wallet — Gram Staking" },
      {
        name: "description",
        content:
          "Track your TON wallet, active and past staking positions, and your AI trading bot performance.",
      },
      { property: "og:title", content: "Wallet — Gram Staking" },
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

  const active = stakes.filter((s) => s.status === "active" && s.verified);
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
        messages: [{ address: TREASURY_WALLET, amount: toNano(value), payload: paymentComment(created.id) }],
      });
      toast.success("Trading bot started. Confirming payment on TON network");
      await refresh();
      void (async () => {
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise((r) => setTimeout(r, 12_000));
          try {
            const res = await verify({
              data: {
                kind: "bot",
                refId: created.id,
                telegramId: tgUser.id,
                sender: address,
              },
            });
            if (res.verified) {
              toast.success("Deposit confirmed on TON network");
              await refresh();
              return;
            }
          } catch {
            /* retry */
          }
        }
      })();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transaction cancelled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={gramCoin.url} alt="Gram token" width={36} height={36} className="h-9 w-9" />
          <h1 className="text-[17px] font-semibold">Wallet</h1>
        </div>
        <Button
          onClick={() => (address ? tonConnectUI.disconnect() : tonConnectUI.openModal())}
          variant="outline"
          size="sm"
          className="tap-scale rounded-full px-3 text-[12px]"
        >
          {address ? "Disconnect" : "Connect"}
        </Button>
      </header>

      <section className="ios-card mt-5 p-5">
        <p className="text-[12px] text-muted-foreground">TON wallet</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[17px] font-medium">{shortAddress(address)}</p>
          {address ? (
            <Button
              onClick={() => {
                navigator.clipboard.writeText(address);
                toast.success("Address copied");
              }}
              variant="ghost"
              size="icon"
              className="tap-scale rounded-full bg-muted p-2"
              aria-label="Copy address"
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Staked</p>
            <p className="text-[15px] font-medium">
              {formatNumber(active.reduce((s, x) => s + Number(x.ton_paid), 0))} TON
            </p>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Confirmed positions</p>
            <p className="text-[15px] font-medium">{active.length}</p>
          </div>
        </div>
      </section>

      <section className="mt-7">
        <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Staking history</h2>
        {stakes.length === 0 ? (
          <p className="ios-card mt-2 px-4 py-6 text-center text-[13px] text-muted-foreground">
            No positions yet.
          </p>
        ) : (
          <div className="ios-card mt-2 divide-y divide-border">
            {stakes.filter((s) => s.verified).map((s) => (
              <div key={s.id} className="px-4 py-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CoinIcon symbol={s.coin} className="h-7 w-7" />
                    <p className="text-[14px] font-medium">
                      {formatNumber(Number(s.amount))} TON · {s.coin === "GRAM" ? "GRAM (ex TON)" : s.coin}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold text-success">{Number(s.apy)}%</p>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progressPct(s.started_at, s.ends_at)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
                  <span>
                    {s.tier} · {s.verified ? "confirmed" : "confirming"} · ends{" "}
                    {new Date(s.ends_at).toLocaleDateString("en-US")}
                  </span>
                  <span>{new Date(s.started_at).toLocaleDateString("en-US")}</span>
                </div>
                {s.status === "completed" && Number(s.rewards_claimed) > 0 ? (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Recorded payout {formatNumber(Number(s.rewards_claimed), 3)} {s.coin}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <h2 className="px-1 text-[13px] font-medium text-muted-foreground">AI trading bot</h2>

        {agent ? (
          <div className="ios-card mt-2 flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[13px] font-medium">Agent wallet</p>
              <p className="text-[12px] text-muted-foreground">
                {agent.live ? shortAddress(agent.address) : "Not linked yet"}
              </p>
            </div>
            <p className="text-[13px] font-medium">
              {agent.live ? `${formatNumber(agent.balanceTon, 3)} TON` : "Analysis mode"}
            </p>
          </div>
        ) : null}

        {markets.length > 0 ? (
          <div className="ios-card mt-2 divide-y divide-border">
            {markets.map((m) => (
              <div key={m.pair} className="flex items-center justify-between px-4 py-3">
                <p className="text-[13px] font-medium">{m.pair}</p>
                <div className="text-right">
                  <p className="text-[13px] font-medium">${formatNumber(m.price, 4)}</p>
                  <p
                    className={
                      m.change24h >= 0
                        ? "text-[11px] text-success"
                        : "text-[11px] text-destructive"
                    }
                  >
                    {m.change24h >= 0 ? "+" : ""}
                    {m.change24h.toFixed(2)}% 24h
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {bot ? (
          <div className="ios-card mt-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-muted-foreground">Live agent wallet</p>
                <p className="text-[26px] font-semibold tracking-tight">
                  {agent?.live ? formatNumber(agent.balanceTon, 3) : "Unavailable"} TON
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12px] font-medium">
                {bot.verified ? bot.status : "confirming"}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">On-chain balance · {bot.risk}</p>

            <div className="mt-4 space-y-2 border-t border-border pt-3">
              {trades.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No confirmed trades yet.</p>
              ) : (
                trades.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1.5">
                      {t.pair} {t.side}
                    </span>
                    <span
                      className="text-muted-foreground"
                    >
                      confirmed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="ios-card mt-3 p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[12px] text-muted-foreground">Activation</p>
                <p className="mt-0.5 text-[20px] font-semibold">${BOT_ACTIVATION_USD}</p>
              </div>
              <p className="text-right text-[12px] text-muted-foreground">
                {activationTon > 0 ? `≈ ${formatNumber(activationTon, 3)} TON` : "Loading TON price"}
              </p>
            </div>
            <label className="mt-4 block text-[12px] text-muted-foreground" htmlFor="deposit">
              Payment amount in TON
            </label>
            <input
              id="deposit"
              inputMode="decimal"
              value={deposit}
              placeholder={activationTon > 0 ? activationTon.toFixed(3) : ""}
              onChange={(e) => setDeposit(e.target.value.replace(/[^0-9.]/g, ""))}
              className="mt-1 w-full bg-transparent text-[28px] font-semibold tracking-tight outline-none"
            />
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1">
              {RISKS.map((r) => (
                <Button
                  key={r}
                  onClick={() => setRisk(r)}
                  variant="ghost"
                  className={
                    risk === r
                      ? "rounded-xl bg-card py-2 text-[12px] font-medium capitalize shadow-sm"
                      : "rounded-xl py-2 text-[12px] font-medium capitalize text-muted-foreground"
                  }
                >
                  {r}
                </Button>
              ))}
            </div>
            <Button
              onClick={startBot}
              disabled={busy}
              className="tap-scale mt-4 h-auto w-full rounded-2xl py-3.5 text-[15px] font-semibold"
            >
              {busy ? "Confirming" : address ? `Activate for $${BOT_ACTIVATION_USD}` : "Connect wallet"}
            </Button>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The bot trades live TON market data with your selected risk level. Markets move, so
              results can be negative.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
