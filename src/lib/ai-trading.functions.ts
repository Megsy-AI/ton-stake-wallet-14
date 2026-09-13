import { createServerFn } from "@tanstack/react-start";

type Market = { pair: string; price: number; change24h: number };

export const BOT_ACTIVATION_USD = 500;

const MARKET_IDS: Record<string, string> = {
  "TON/USDT": "the-open-network",
  "USDT/USD": "tether",
  "NOT/USDT": "notcoin",
  "DOGS/USDT": "dogs-2",
};

async function loadMarkets(): Promise<Market[]> {
  const ids = Object.values(MARKET_IDS).join(",");
  const symbols = ["TONUSDT", "NOTUSDT", "DOGSUSDT"];
  const [coinGeckoResult, binanceResult] = await Promise.allSettled([
    fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { headers: { accept: "application/json" } },
    ).then(async (response) => {
      if (!response.ok) return [] as Market[];
      const json = (await response.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
      return Object.entries(MARKET_IDS).flatMap(([pair, id]) => {
        const row = json[id];
        return row?.usd ? [{ pair, price: row.usd, change24h: row.usd_24h_change ?? 0 }] : [];
      });
    }),
    Promise.all(symbols.map(async (symbol) => {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
      if (!response.ok) return null;
      const row = await response.json() as { lastPrice?: string; priceChangePercent?: string };
      const price = Number(row.lastPrice);
      if (!Number.isFinite(price) || price <= 0) return null;
      const pair = symbol === "TONUSDT" ? "TON/USDT" : symbol === "NOTUSDT" ? "NOT/USDT" : "DOGS/USDT";
      return { pair, price, change24h: Number(row.priceChangePercent) || 0 };
    })),
  ]);

  const coinGecko = coinGeckoResult.status === "fulfilled" ? coinGeckoResult.value : [];
  const binance = binanceResult.status === "fulfilled"
    ? binanceResult.value.filter((market): market is Market => market !== null)
    : [];
  const byPair = new Map<string, Market>();
  for (const market of [{ pair: "USDT/USD", price: 1, change24h: 0 }, ...binance, ...coinGecko]) {
    byPair.set(market.pair, market);
  }
  return [...byPair.values()];
}

/** Live market snapshot used by the wallet screen. */
export const getMarkets = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { markets: await loadMarkets() };
  } catch {
    return { markets: [] as Market[] };
  }
});

export const createTradingBot = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      telegramId: number;
      walletAddress: string;
      depositTon: number;
      risk: "conservative" | "balanced" | "aggressive";
      txHash: string | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const ton = (await loadMarkets()).find((market) => market.pair === "TON/USDT");
    if (!ton?.price) throw new Error("TON price is temporarily unavailable");
    const requiredTon = BOT_ACTIVATION_USD / ton.price;
    if (!Number.isFinite(data.depositTon) || data.depositTon < requiredTon * 0.995) {
      throw new Error(`Activation requires $${BOT_ACTIVATION_USD} in TON`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot, error } = await supabaseAdmin
      .from("tt_ai_bots")
      .insert({
        telegram_id: data.telegramId,
        wallet_address: data.walletAddress,
        deposit: data.depositTon,
        balance: 0,
        risk: data.risk,
        tx_hash: data.txHash,
        status: "pending",
        verified: false,
      })
      .select()
      .single();
    if (error) throw new Error("Could not create the trading bot");
    return bot;
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bot } = await supabaseAdmin
      .from("tt_ai_bots")
      .select("*")
      .eq("id", data.botId)
      .maybeSingle();
    if (!bot || bot.status !== "running" || !bot.verified) {
      return { ok: false, reason: "bot_inactive" };
    }

    const markets = await loadMarkets();
    if (!markets.length) return { ok: false, reason: "no_market_data" };

    const { data: open } = await supabaseAdmin
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
      await supabaseAdmin
        .from("tt_ai_trades")
        .update({
          exit_price: market.price,
          pnl,
          status: "closed",
          closed_at: new Date().toISOString(),
        })
        .eq("id", open.id);
      await supabaseAdmin
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
        return { ok: false, reason: "live_buy_failed" };
      }
    }

    if (!live) return { ok: true, action: "hold", reason: "no_live_signal" };

    await supabaseAdmin.from("tt_ai_trades").insert({
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
