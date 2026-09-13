import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { toast } from "sonner";
import { ArrowUpRight, Check } from "lucide-react";
import gramCoin from "@/assets/gram.png.asset.json";
import { CoinIcon } from "@/components/CoinIcon";
import { Button } from "@/components/ui/button";
import {
  ASSETS,
  TIERS,
  MIN_STAKE,
  TREASURY_WALLET,
  COMMUNITY_URL,
  estimateReward,
  formatNumber,
  shortAddress,
  tierForAmount,
  toNano,
  paymentComment,
} from "@/lib/tt";
import { createStakeIntent, listStakes, type StakeRow } from "@/lib/tt-data.functions";
import { getTelegramUserSync } from "@/lib/telegram-user";
import { verifyPayment } from "@/lib/ton-verify.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EGRAM — Stake on TON" },
      {
        name: "description",
        content:
          "Stake GRAM, USDT, NOT and DOGS on TON with tiered projected yields.",
      },
      { property: "og:title", content: "EGRAM — Stake on TON" },
      {
        property: "og:description",
        content: "Tiered staking for TON-network assets inside Telegram.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StakePage,
});

const QUICK = [50, 200, 1000, 5000];

function StakePage() {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const [asset, setAsset] = useState("GRAM");
  const [amount, setAmount] = useState("200");
  const [busy, setBusy] = useState(false);
  const [stakes, setStakes] = useState<StakeRow[]>([]);
  const verify = useServerFn(verifyPayment);
  const fetchStakes = useServerFn(listStakes);
  const prepareStake = useServerFn(createStakeIntent);

  const tgUser = useMemo(() => getTelegramUserSync(), []);
  const value = Number(amount) || 0;
  const tier = tierForAmount(value);
  const reward = estimateReward(value, tier.apy, tier.lockDays);

  useEffect(() => {
    fetchStakes({ data: { telegramId: tgUser.id } }).then(setStakes).catch(() => undefined);
  }, [tgUser.id, fetchStakes]);

  const confirmedStakes = stakes.filter((s) => s.status === "active" && s.verified);
  const totalStaked = confirmedStakes.reduce((sum, s) => sum + Number(s.ton_paid), 0);

  const confirmOnChain = async (refId: string, paid: number) => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 12_000));
      try {
        const res = await verify({
          data: {
            kind: "stake",
            refId,
            telegramId: tgUser.id,
            sender: address,
          },
        });
        if (res.verified) {
          toast.success("Payment confirmed on TON network");
          setStakes(await fetchStakes({ data: { telegramId: tgUser.id } }));
          return;
        }
      } catch {
        /* retry */
      }
    }
  };

  const stake = async () => {
    if (!address) {
      tonConnectUI.openModal();
      return;
    }
    if (value < MIN_STAKE) {
      toast.error(`Minimum stake is ${MIN_STAKE} TON`);
      return;
    }
    setBusy(true);
    try {
      const created = await prepareStake({
        data: {
          telegramId: tgUser.id,
          walletAddress: address,
          coin: asset,
          amount: value,
        },
      });
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: TREASURY_WALLET, amount: toNano(value), payload: await paymentComment(created.id) }],
      });
      toast.success(`${tier.name} stake opened. Confirming on TON network`);
      setStakes(await fetchStakes({ data: { telegramId: tgUser.id } }));
      void confirmOnChain(created.id, value);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction cancelled";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={gramCoin.url} alt="Gram token" width={38} height={38} className="h-9.5 w-9.5 rounded-full" />
          <div>
            <h1 className="display-type text-[17px] font-semibold leading-none">EGRAM</h1>
            <p className="mt-1 text-[10px] font-semibold uppercase text-muted-foreground">Staking protocol</p>
          </div>
        </div>
        <Button onClick={() => (address ? tonConnectUI.disconnect() : tonConnectUI.openModal())} variant="outline" size="sm" className="tap-scale h-9 rounded-full border-border bg-card px-4 text-[11px] font-semibold shadow-none">
          {address ? shortAddress(address) : "Connect"}
        </Button>
      </header>

      <section className="graphite-card mt-5 overflow-hidden p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-primary-foreground/55">TOTAL STAKED</p>
            <p className="display-type mt-2 text-[36px] font-semibold leading-none">{formatNumber(totalStaked)}</p>
            <p className="mt-2 text-[12px] text-primary-foreground/55">TON network · verified only</p>
          </div>
          <div className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-medium">{confirmedStakes.length} active</div>
        </div>
        <div className="mt-7 flex items-end justify-between border-t border-primary-foreground/10 pt-4">
          <div><p className="text-[10px] text-primary-foreground/45">CURRENT TIER</p><p className="mt-1 text-[13px] font-semibold">{tierForAmount(totalStaked || value).name}</p></div>
          <div className="text-right"><p className="text-[10px] text-primary-foreground/45">SELECTED APY</p><p className="mt-1 text-[18px] font-semibold text-accent">{tier.apy}%</p></div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">New position</h2><span className="text-[11px] text-muted-foreground">Choose asset</span></div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {ASSETS.map((a) => (
            <Button key={a.symbol} onClick={() => setAsset(a.symbol)} variant="ghost" className={asset === a.symbol ? "tap-scale h-[68px] flex-col gap-1.5 rounded-xl border border-primary bg-card px-1 shadow-sm" : "tap-scale h-[68px] flex-col gap-1.5 rounded-xl border border-border bg-card px-1 text-muted-foreground shadow-none"}>
              <CoinIcon symbol={a.symbol} className="h-7 w-7" />
              <span className="max-w-full truncate text-[10px] font-semibold">{a.symbol === "GRAM" ? "GRAM" : a.label}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="ios-card mt-3 p-4">
        <div className="flex items-end justify-between border-b border-border pb-3">
          <div className="min-w-0 flex-1">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground" htmlFor="amount">Amount in TON</label>
            <input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} className="display-type mt-1 w-full bg-transparent text-[34px] font-semibold leading-none outline-none" />
          </div>
          <span className="mb-1 text-[13px] font-semibold text-muted-foreground">TON</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {QUICK.map((q) => <Button key={q} onClick={() => setAmount(String(q))} variant="ghost" className="tap-scale h-8 rounded-lg bg-muted px-1 text-[11px] font-semibold">{formatNumber(q)}</Button>)}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center">
          <div><dt className="text-[9px] font-semibold uppercase text-muted-foreground">Tier</dt><dd className="mt-1 text-[12px] font-semibold">{tier.name}</dd></div>
          <div><dt className="text-[9px] font-semibold uppercase text-muted-foreground">Lock</dt><dd className="mt-1 text-[12px] font-semibold">{tier.lockDays} days</dd></div>
          <div><dt className="text-[9px] font-semibold uppercase text-muted-foreground">Projected</dt><dd className="mt-1 text-[12px] font-semibold text-success">+{formatNumber(reward, 2)}</dd></div>
        </dl>
        <Button onClick={stake} disabled={busy} className="tap-scale mt-3 h-12 w-full rounded-xl bg-primary text-[14px] font-semibold shadow-none">
          {busy ? "Confirming" : address ? `Stake ${formatNumber(value)} TON` : "Connect wallet to stake"}
        </Button>
      </section>

      <section className="mt-7">
        <div className="flex items-end justify-between px-1"><h2 className="display-type text-[18px] font-semibold">Yield levels</h2><span className="text-[11px] text-muted-foreground">Projected APY</span></div>
        <div className="mt-2 divide-y divide-border border-y border-border">
          {TIERS.map((t) => <div key={t.key} className="flex items-center justify-between py-3"><div><p className="text-[13px] font-semibold">{t.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{formatNumber(t.min)}{t.max ? ` – ${formatNumber(t.max)}` : "+"} TON · {t.lockDays} days</p></div><p className="display-type text-[16px] font-semibold text-success">{t.apy}%</p></div>)}
        </div>
      </section>

      <section className="mt-7 border-t border-border pt-4" aria-label="Partners"><p className="text-[9px] font-semibold uppercase text-muted-foreground">Infrastructure partners</p><div className="mt-3 flex items-center justify-between text-[12px] font-semibold text-muted-foreground"><span>Google</span><span>Alibaba</span><span>Megsy AI</span></div></section>
      <a href={COMMUNITY_URL} target="_blank" rel="noreferrer" className="tap-scale mt-5 flex items-center justify-between border-b border-border py-3 text-[13px] font-semibold">Join the community<ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} /></a>
    </main>
  );
}
