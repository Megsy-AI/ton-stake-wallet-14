import { TonClient, WalletContractV4, JettonMaster, type OpenedContract } from "@ton/ton";
import { Address, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { DEX, pTON } from "@ston-fi/sdk";

export const JETTONS: Record<string, string> = {
  "USDT/TON": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  "NOT/USDT": "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
  "DOGS/USDT": "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS",
  "TON/USDT": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
};

const ROUTER = "EQBCl1JANkTrGLwmyi6point8zqUS1AHJ8Ki01AsHhdaLbcp";
const PTON = "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S";

function endpoint(): string {
  const key = process.env["TONCENTER_API_KEY"];
  return key
    ? `https://toncenter.com/api/v2/jsonRPC?api_key=${key}`
    : "https://toncenter.com/api/v2/jsonRPC";
}

export function tradingEnabled(): boolean {
  return Boolean(process.env["TT_TRADING_WALLET_MNEMONIC"]);
}

async function openWallet() {
  const phrase = process.env["TT_TRADING_WALLET_MNEMONIC"];
  if (!phrase) throw new Error("Trading wallet is not configured");
  const keyPair = await mnemonicToPrivateKey(phrase.trim().split(/\s+/));
  const client = new TonClient({ endpoint: endpoint() });
  const wallet = client.open(
    WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey }),
  );
  return { client, wallet, keyPair };
}

/** Public, non-secret info about the agent wallet. */
export async function tradingWalletInfo() {
  const { wallet } = await openWallet();
  const balance = await wallet.getBalance();
  return {
    address: wallet.address.toString({ urlSafe: true, bounceable: false }),
    balanceTon: Number(balance) / 1e9,
  };
}

type Wallet = OpenedContract<WalletContractV4>;

async function routerFor(client: TonClient) {
  return client.open(DEX.v2_2.Router.create(Address.parse(ROUTER)));
}

/** Buys a jetton with TON on STON.fi from the agent wallet. */
export async function buyWithTon(pair: string, amountTon: number) {
  const jetton = JETTONS[pair];
  if (!jetton) throw new Error(`Unsupported pair ${pair}`);
  const { client, wallet, keyPair } = await openWallet();
  const router = await routerFor(client);
  const params = await router.getSwapTonToJettonTxParams({
    userWalletAddress: wallet.address,
    proxyTon: pTON.v2_1.create(Address.parse(PTON)),
    offerAmount: toNano(amountTon.toFixed(6)),
    askJettonAddress: Address.parse(jetton),
    minAskAmount: "1",
    queryId: Date.now() % 1_000_000,
  });
  const sender = (wallet as Wallet).sender(keyPair.secretKey);
  await sender.send(params);
  return { ok: true as const };
}

/** Sells a jetton back into TON on STON.fi from the agent wallet. */
export async function sellForTon(pair: string, jettonUnits: bigint) {
  const jetton = JETTONS[pair];
  if (!jetton) throw new Error(`Unsupported pair ${pair}`);
  const { client, wallet, keyPair } = await openWallet();
  const router = await routerFor(client);
  const params = await router.getSwapJettonToTonTxParams({
    userWalletAddress: wallet.address,
    offerJettonAddress: Address.parse(jetton),
    offerAmount: jettonUnits,
    minAskAmount: "1",
    proxyTon: pTON.v2_1.create(Address.parse(PTON)),
    queryId: Date.now() % 1_000_000,
  });
  const sender = (wallet as Wallet).sender(keyPair.secretKey);
  await sender.send(params);
  return { ok: true as const };
}

/** Current jetton balance of the agent wallet, in raw units. */
export async function jettonBalance(pair: string): Promise<bigint> {
  const jetton = JETTONS[pair];
  if (!jetton) return 0n;
  const { client, wallet } = await openWallet();
  const master = client.open(JettonMaster.create(Address.parse(jetton)));
  const walletAddress = await master.getWalletAddress(wallet.address);
  const state = await client.getContractState(walletAddress);
  if (state.state !== "active") return 0n;
  const res = await client.runMethod(walletAddress, "get_wallet_data");
  return res.stack.readBigNumber();
}
