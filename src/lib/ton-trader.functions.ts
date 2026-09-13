import { createServerFn } from "@tanstack/react-start";

export const getWalletBalance = createServerFn({ method: "GET" })
  .inputValidator((input: { address: string }) => input)
  .handler(async ({ data }) => {
    try {
      const [{ TonClient }, { Address }] = await Promise.all([
        import("@ton/ton"),
        import("@ton/core"),
      ]);
      const key = process.env["TONCENTER_API_KEY"];
      const endpoint = key
        ? `https://toncenter.com/api/v2/jsonRPC?api_key=${key}`
        : "https://toncenter.com/api/v2/jsonRPC";
      const client = new TonClient({ endpoint });
      const balance = await client.getBalance(Address.parse(data.address));
      return { balanceTon: Number(balance) / 1e9, live: true };
    } catch {
      return { balanceTon: 0, live: false };
    }
  });

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

