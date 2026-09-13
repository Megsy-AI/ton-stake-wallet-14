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

