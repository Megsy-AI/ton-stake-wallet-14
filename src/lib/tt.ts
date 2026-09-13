export const TREASURY_WALLET = "UQAp1QxnLJ2z44IooUovvtVShw7hJBEdxCRV3RlbCYC3D8qj";

export const COMMUNITY_URL = "https://t.me/goacco";
export const BOT_URL = "https://t.me/Rielmbot";

export type Asset = {
  symbol: string;
  name: string;
};

export const ASSETS: Asset[] = [
  { symbol: "GRAM", name: "Gram" },
  { symbol: "TON", name: "Toncoin" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "NOT", name: "Notcoin" },
];

export type Tier = {
  key: string;
  name: string;
  min: number;
  max: number | null;
  apy: number;
  lockDays: number;
};

export const TIERS: Tier[] = [
  { key: "core", name: "Core", min: 1, max: 49, apy: 12, lockDays: 30 },
  { key: "plus", name: "Plus", min: 50, max: 199, apy: 18, lockDays: 60 },
  { key: "prime", name: "Prime", min: 200, max: 999, apy: 26, lockDays: 90 },
  { key: "elite", name: "Elite", min: 1000, max: 4999, apy: 34, lockDays: 120 },
  { key: "titan", name: "Titan", min: 5000, max: null, apy: 45, lockDays: 180 },
];

export const MIN_STAKE = TIERS[0]!.min;

export function tierForAmount(amount: number): Tier {
  let match = TIERS[0] as Tier;
  for (const tier of TIERS) {
    if (amount >= tier.min) match = tier;
  }
  return match;
}

export function toNano(amount: number): string {
  return BigInt(Math.round(amount * 1e9)).toString();
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
