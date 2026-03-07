import { ApiPromise, WsProvider } from "@polkadot/api";
import type { InjectedExtension } from "@polkadot/extension-inject/types";

const POLKASEND_WS = process.env.NEXT_PUBLIC_POLKASEND_WS ?? "wss://polkasend-testnet.example.com";
const RELAY_WS = process.env.NEXT_PUBLIC_RELAY_WS ?? "wss://rpc.polkadot.io";

let polkaSendApi: ApiPromise | null = null;
let relayApi: ApiPromise | null = null;

export async function getPolkaSendApi(): Promise<ApiPromise> {
  if (polkaSendApi && polkaSendApi.isConnected) return polkaSendApi;
  const provider = new WsProvider(POLKASEND_WS);
  polkaSendApi = await ApiPromise.create({ provider });
  return polkaSendApi;
}

export async function getRelayApi(): Promise<ApiPromise> {
  if (relayApi && relayApi.isConnected) return relayApi;
  const provider = new WsProvider(RELAY_WS);
  relayApi = await ApiPromise.create({ provider });
  return relayApi;
}

export async function getExtension(): Promise<InjectedExtension[]> {
  const { web3Enable } = await import("@polkadot/extension-dapp");
  return web3Enable("PolkaSend");
}

export async function getAccounts() {
  await getExtension();
  const { web3Accounts } = await import("@polkadot/extension-dapp");
  return web3Accounts();
}

// ─── Parachain calls ─────────────────────────────────────────────────────────

export async function queryKycRecord(accountId: string) {
  const api = await getPolkaSendApi();
  const record = await api.query["kyc"]["kycRecords"](accountId);
  return record.toJSON();
}

export async function queryOrders(accountId: string) {
  const api = await getPolkaSendApi();
  const orderIds = await api.query["remittance"]["userOrders"](accountId);
  const ids = (orderIds.toJSON() as string[]) ?? [];
  const orders = await Promise.all(
    ids.map((id) => api.query["remittance"]["orders"](id))
  );
  return orders.map((o) => o.toJSON());
}

export async function subscribeToBlocks(cb: (blockNumber: number) => void) {
  const api = await getRelayApi();
  return api.rpc.chain.subscribeNewHeads((header) => {
    cb(header.number.toNumber());
  });
}

// ─── XCM helpers ─────────────────────────────────────────────────────────────

export const ASSET_IDS: Record<string, number> = {
  USDC: 1337,
  USDT: 1984,
  DAI: 1338,
};

export const PARA_IDS = {
  POLKASEND: 3000,
  ACALA: 2000,
  ASSET_HUB: 1000,
  MOONBEAM: 2004,
} as const;

export function formatAddress(addr: string, chars = 6): string {
  if (!addr) return "";
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}

export function toMicroUnits(amount: number, decimals = 6): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

export function fromMicroUnits(amount: bigint, decimals = 6): number {
  return Number(amount) / 10 ** decimals;
}
