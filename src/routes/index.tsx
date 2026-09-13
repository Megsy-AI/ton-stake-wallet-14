import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { toast } from "sonner";
import { ArrowUpRight, Check, Lock, Wallet2 } from "lucide-react";
import gramCoin from "@/assets/gram-coin.png";
import {
  ASSETS,
  TIERS,
  TREASURY_WALLET,
  COMMUNITY_URL,
  estimateReward,
  formatNumber,
  shortAddress,
  tierForAmount,
  toNano,
} from "@/lib/tt";
import { createStake, listStakes, upsertUser, type StakeRow } from "@/lib/tt-api";
import { getTelegramUserSync } from "@/lib/telegram-user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gram Staking — Earn on GRAM and TON" },
      {
        name: "description",
        content:
          "Stake GRAM, TON, USDT and NOT on the TON network with tiered yields that grow with your amount.",
      },
      { property: "og:title", content: "Gram Staking — Earn on GRAM and TON" },
      {
        property: "og:description",
        content: "Tiered staking for GRAM and TON assets inside Telegram.",
      },
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

  const tgUser = useMemo(() => getTelegramUserSync(), []);
  const value = Number(amount) || 0;
  const tier = tierForAmount(value);
  const reward = estimateReward(value, tier.apy, tier.lockDays);

  useEffect(() => {
    upsertUser({
      telegram_id: tgUser.id,
      username: tgUser.username,
      first_name: tgUser.first_name,
      wallet_address: address || null,
    }).catch(() => undefined);
    listStakes(tgUser.id).then(setStakes).catch(() => undefined);
  }, [tgUser, address]);

  const totalStaked = stakes
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  const stake = async () => {
    if (!address) {
      tonConnectUI.openModal();
      return;
    }
    if (value < TIERS[0].min) {
      toast.error(`Minimum stake is ${TIERS[0].min} TON`);
      return;
    }
    setBusy(true);
    try {
      const result = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{ address: TREASURY_WALLET, amount: toNano(value) }],
      });
      await createStake({
        telegram_id: tgUser.id,
        wallet_address: address,
        coin: asset,
        amount: value,
        tier: tier.name,
        apy: tier.apy,
        lock_days: tier.lockDays,
        tx_hash: result?.boc ? result.boc.slice(0, 64) : null,
      });
      toast.success(`${tier.name} stake opened`);
      setStakes(await listStakes(tgUser.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction cancelled";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md px-5 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={gramCoin} alt="Gram token" width={36} height={36} className="h-9 w-9" />
          <div>
            <h1 className="text-[17px] font-semibold leading-tight">Gram Staking</h1>
            <p className="text-[12px] text-muted-foreground">TON network</p>
          </div>
        </div>
        <button
          onClick={() => (address ? tonConnectUI.disconnect() : tonConnectUI.openModal())}
          className="tap-scale flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-[12px] font-medium"
        >
          <Wallet2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
          {address ? shortAddress(address) : "Connect wallet"}
        </button>
      </header>

      <section className="ios-card mt-5 p-5">
        <p className="text-[12px] text-muted-foreground">Total staked</p>
        <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight">
          {formatNumber(totalStaked)} <span className="text-[18px] text-muted-foreground">TON</span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Active positions</p>
            <p className="text-[15px] font-medium">
              {stakes.filter((s) => s.status === "active").length}
            </p>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">Your tier</p>
            <p className="text-[15px] font-medium">{tierForAmount(totalStaked || value).name}</p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Asset</h2>
        <div className="mt-2 grid grid-cols-4 gap-2 rounded-2xl bg-muted p-1">
          {ASSETS.map((a) => (
            <button
              key={a.symbol}
              onClick={() => setAsset(a.symbol)}
              className={
                asset === a.symbol
                  ? "rounded-xl bg-card py-2 text-[13px] font-medium shadow-sm"
                  : "rounded-xl py-2 text-[13px] font-medium text-muted-foreground"
              }
            >
              {a.symbol}
            </button>
          ))}
        </div>
      </section>

      <section className="ios-card mt-4 p-5">
        <label className="text-[12px] text-muted-foreground" htmlFor="amount">
          Amount in TON
        </label>
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="mt-1 w-full bg-transparent text-[30px] font-semibold tracking-tight outline-none"
        />
        <div className="mt-3 flex gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className="tap-scale flex-1 rounded-full bg-muted py-2 text-[12px] font-medium text-secondary-foreground"
            >
              {formatNumber(q)}
            </button>
          ))}
        </div>

        <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tier</dt>
            <dd className="font-medium">{tier.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Yearly rate</dt>
            <dd className="font-medium text-success">{tier.apy}%</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Lock period</dt>
            <dd className="font-medium">{tier.lockDays} days</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated reward</dt>
            <dd className="font-medium">
              {formatNumber(reward, 3)} {asset}
            </dd>
          </div>
        </dl>

        <button
          onClick={stake}
          disabled={busy}
          className="tap-scale mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Lock className="h-4 w-4" strokeWidth={1.9} />
          {busy ? "Confirming" : address ? `Stake ${formatNumber(value)} TON` : "Connect wallet"}
        </button>
      </section>

      <section className="mt-7">
        <h2 className="px-1 text-[13px] font-medium text-muted-foreground">Tiers</h2>
        <div className="ios-card mt-2 divide-y divide-border">
          {TIERS.map((t) => {
            const active = t.key === tier.key;
            return (
              <div key={t.key} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="flex items-center gap-1.5 text-[14px] font-medium">
                    {t.name}
                    {active ? (
                      <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.2} />
                    ) : null}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    {formatNumber(t.min)}
                    {t.max ? ` – ${formatNumber(t.max)}` : "+"} TON · {t.lockDays} days
                  </p>
                </div>
                <p className="text-[15px] font-semibold text-success">{t.apy}%</p>
              </div>
            );
          })}
        </div>
      </section>

      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noreferrer"
        className="tap-scale mt-5 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-[14px] font-medium"
      >
        Join the community
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
      </a>
    </main>
  );
}
