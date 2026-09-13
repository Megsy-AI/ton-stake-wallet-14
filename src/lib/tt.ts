export const TREASURY_WALLET = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";

export const COMMUNITY_URL = "https://t.me/goacco";
export const BOT_URL = "https://t.me/Rielmbot";

export type Asset = {
  symbol: string;
  name: string;
  label: string;
};

export const ASSETS: Asset[] = [
  { symbol: "GRAM", name: "Gram", label: "GRAM (ex TON)" },
  { symbol: "USDT", name: "Tether", label: "USDT" },
  { symbol: "NOT", name: "Notcoin", label: "NOT" },
  { symbol: "DOGS", name: "Dogs", label: "DOGS" },
];

export type Tier = {
  key: string;
  name: string;
  min: number;
  max: number | null;
  apy: number;
  lockDays: number;
};

export const STAKING_OFFERS = {
  GRAM: { baseApy: 18, maxApy: 52, lockDays: 120, min: 1, description: "Network growth" },
  USDT: { baseApy: 11, maxApy: 28, lockDays: 60, min: 10, description: "Stablecoin yield" },
  NOT: { baseApy: 20, maxApy: 58, lockDays: 90, min: 50, description: "Ecosystem rewards" },
  DOGS: { baseApy: 22, maxApy: 62, lockDays: 90, min: 100, description: "Community pool" },
} as const;

export const TIERS: Tier[] = [
  { key: "core", name: "Core", min: 1, max: 49, apy: 18, lockDays: 30 },
  { key: "plus", name: "Plus", min: 50, max: 199, apy: 26, lockDays: 60 },
  { key: "prime", name: "Prime", min: 200, max: 999, apy: 36, lockDays: 90 },
  { key: "elite", name: "Elite", min: 1000, max: 4999, apy: 45, lockDays: 120 },
  { key: "titan", name: "Titan", min: 5000, max: null, apy: 52, lockDays: 180 },
];

export const MIN_STAKE = TIERS[0]!.min;

export function tierForAmount(amount: number, symbol = "GRAM"): Tier {
  let match = TIERS[0] as Tier;
  for (const tier of TIERS) {
    if (amount >= tier.min) match = tier;
  }
  const offer = STAKING_OFFERS[symbol as keyof typeof STAKING_OFFERS] ?? STAKING_OFFERS.GRAM;
  const progress = TIERS.findIndex((tier) => tier.key === match.key) / (TIERS.length - 1);
  return {
    ...match,
    apy: Math.round(offer.baseApy + (offer.maxApy - offer.baseApy) * progress),
    lockDays: Math.max(match.lockDays, offer.lockDays),
  };
}

export function toNano(amount: number): string {
  return BigInt(Math.round(amount * 1e9)).toString();
}

export async function paymentComment(refId: string): Promise<string> {
  const [{ Buffer }, { beginCell }] = await Promise.all([import("buffer"), import("@ton/core")]);
  if (!(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer) {
    (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer;
  }
  return beginCell().storeUint(0, 32).storeStringTail(`tt:${refId}`).endCell().toBoc().toString("base64");
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function shortAddress(address?: string | null): string {
  if (!address) return "Not connected";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function estimateReward(amount: number, apy: number, lockDays: number): number {
  return (amount * apy * lockDays) / (100 * 365);
}

export function accruedReward(
  amount: number,
  apy: number,
  startedAt: string,
  endsAt: string,
): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  const now = Math.min(Date.now(), end);
  const days = Math.max(0, (now - start) / 86_400_000);
  return (amount * apy * days) / (100 * 365);
}

export function progressPct(startedAt: string, endsAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  if (end <= start) return 100;
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
}
