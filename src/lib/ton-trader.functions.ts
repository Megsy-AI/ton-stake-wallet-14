import { createServerFn } from "@tanstack/react-start";

/** Agent wallet status shown in the app: address, TON balance, live mode flag. */
export const getAgentWallet = createServerFn({ method: "GET" }).handler(async () => {
  if (!process.env["TT_TRADING_WALLET_MNEMONIC"]) {
    return { live: false, address: null as string | null, balanceTon: 0 };
  }
  try {
    const { tradingWalletInfo } = await import("@/lib/ton-trader.server");
    const info = await tradingWalletInfo();
    return { live: true, address: info.address, balanceTon: info.balanceTon };
  } catch (err) {
    console.error("agent wallet error", err);
    return { live: false, address: null as string | null, balanceTon: 0 };
  }
});

/** Executes one real on-chain swap for the agent wallet. */
export const executeAgentTrade = createServerFn({ method: "POST" })
  .inputValidator((input: { pair: string; side: "buy" | "sell"; amountTon: number }) => input)
  .handler(async ({ data }) => {
    if (!process.env["TT_TRADING_WALLET_MNEMONIC"]) {
      return { ok: false, reason: "wallet_not_configured" };
    }
    const trader = await import("@/lib/ton-trader.server");
    try {
      if (data.side === "buy") {
        await trader.buyWithTon(data.pair, data.amountTon);
      } else {
        const units = await trader.jettonBalance(data.pair);
        if (units <= 0n) return { ok: false, reason: "no_position" };
        await trader.sellForTon(data.pair, units);
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "swap failed";
      console.error("agent trade failed", message);
      return { ok: false, reason: message };
    }
  });
