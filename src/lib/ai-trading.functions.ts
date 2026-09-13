import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type Market = { pair: string; price: number; change24h: number };

const MARKET_IDS: Record<string, string> = {
  "TON/USDT": "the-open-network",
  "NOT/USDT": "notcoin",
  "DOGS/USDT": "dogs-2",
};

function serverClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadMarkets(): Promise<Market[]> {
  const ids = Object.values(MARKET_IDS).join(",");
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Market data unavailable [${res.status}]`);
  const json = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  return Object.entries(MARKET_IDS)
    .map(([pair, id]) => {
      const row = json[id];
      if (!row?.usd) return null;
      return { pair, price: row.usd, change24h: row.usd_24h_change ?? 0 };
    })
    .filter((m): m is Market => m !== null);
}

/** Live market snapshot used by the wallet screen. */
export const getMarkets = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { markets: await loadMarkets() };
  } catch {
    return { markets: [] as Market[] };
  }
});

const RISK_SIZE: Record<string, number> = { conservative: 0.1, balanced: 0.2, aggressive: 0.35 };

/**
 * Runs one trading cycle for a bot against live market prices:
 * closes an open position when the move is decided, otherwise opens a new one
 * following 24h momentum.
 */
export const runAiCycle = createServerFn({ method: "POST" })
  .inputValidator((input: { botId: string }) => input)
  .handler(async ({ data }) => {
    const supabase = serverClient();
    const { data: bot } = await supabase
      .from("tt_ai_bots")
      .select("*")
      .eq("id", data.botId)
      .maybeSingle();
    if (!bot || bot.status !== "running") return { ok: false, reason: "bot_inactive" };

    const markets = await loadMarkets();
    if (!markets.length) return { ok: false, reason: "no_market_data" };

    const { data: open } = await supabase
      .from("tt_ai_trades")
      .select("*")
      .eq("bot_id", bot.id)
      .eq("status", "open")
      .maybeSingle();

    if (open) {
      const market = markets.find((m) => m.pair === open.pair);
      if (!market) return { ok: false, reason: "pair_missing" };
      const move = (market.price - Number(open.entry_price)) / Number(open.entry_price);
      const directional = open.side === "long" ? move : -move;
      const age = Date.now() - new Date(open.opened_at).getTime();
      const shouldClose = Math.abs(directional) >= 0.004 || age > 10 * 60_000;
      if (!shouldClose) return { ok: true, action: "hold" };

      const pnl = Number(open.size) * directional;
      if (process.env["TT_TRADING_WALLET_MNEMONIC"]) {
        try {
          const trader = await import("@/lib/ton-trader.server");
          const units = await trader.jettonBalance(open.pair);
          if (units > 0n) await trader.sellForTon(open.pair, units);
        } catch (err) {
          console.error("live sell failed", err);
        }
      }
      await supabase
        .from("tt_ai_trades")
        .update({
          exit_price: market.price,
          pnl,
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", open.id);
      await supabase
        .from("tt_ai_bots")
        .update({
          balance: Number(bot.balance) + pnl,
          pnl: Number(bot.pnl) + pnl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bot.id);
      return { ok: true, action: "close", pnl };
    }

    const ranked = [...markets].sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));
    const pick = ranked[0];
    if (!pick) return { ok: false, reason: "no_market_data" };
    const size = Number(bot.balance) * (RISK_SIZE[bot.risk] ?? 0.2);
    if (size <= 0) return { ok: false, reason: "no_balance" };

    let live = false;
    if (process.env["TT_TRADING_WALLET_MNEMONIC"] && pick.change24h >= 0) {
      try {
        const trader = await import("@/lib/ton-trader.server");
        await trader.buyWithTon(pick.pair, Math.min(size, 5));
        live = true;
      } catch (err) {
        console.error("live buy failed", err);
      }
    }

    await supabase.from("tt_ai_trades").insert({
      bot_id: bot.id,
      telegram_id: bot.telegram_id,
      pair: pick.pair,
      side: pick.change24h >= 0 ? "long" : "short",
      size,
      entry_price: pick.price,
      status: "open",
      pnl: 0,
    });
    return { ok: true, action: "open", pair: pick.pair, live };
  });
