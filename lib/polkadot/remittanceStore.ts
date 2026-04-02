import { create } from "zustand";
import axios from "axios";
import { decodeAddress } from "@polkadot/util-crypto";
import {
  buildInitiateRemittance,
  getPolkadotApi,
  queryFxRate,
  submitWithInjectedSigner,
  type DeliveryMode as ChainDeliveryMode,
} from "./api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";
const ASSET_IDS = {
  USDC: 1337,
  USDT: 1984,
  DAI: 1338,
} as const;

export type DeliveryMode = "upi" | "imps" | "iinr" | "aadhaar";
export type ClientOrderStatus =
  | "Initiated"
  | "RateLocked"
  | "CompliancePassed"
  | "SettlementTriggered"
  | "Completed"
  | "Failed";

export interface ContractContext {
  chainId: string;
  paraId: number;
  palletCall: string;
  args: {
    recipient: string;
    assetId: number;
    amount: string;
    deliveryMode: string;
  };
  quote: {
    fxRateScaled: number;
    amountOutInrPaise: number;
    feeBps: number;
  };
}

export interface OrderTimelineEvent {
  type: string;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface RemittanceState {
  // Form state
  sendAmount: string;
  sendCurrency: "USDC" | "USDT" | "DAI";
  recipientId: string;
  deliveryMode: DeliveryMode;

  // Computed
  fxRate: number;
  receiveAmountInr: number;
  feePct: number;

  // Order lifecycle
  orderId: string | null;
  orderStatus: ClientOrderStatus | null;
  contractStatus: string | null;
  utrNumber: string | null;
  txHash: string | null;
  integrationMode: string | null;
  contractContext: ContractContext | null;
  timeline: OrderTimelineEvent[];
  isSubmitting: boolean;
  error: string | null;

  // Actions
  setSendAmount: (v: string) => void;
  setSendCurrency: (v: "USDC" | "USDT" | "DAI") => void;
  setRecipientId: (v: string) => void;
  setDeliveryMode: (v: DeliveryMode) => void;
  fetchFxRate: () => Promise<void>;
  submitRemittance: (senderAddress: string) => Promise<void>;
  pollOrderStatus: (orderId: string) => Promise<void>;
  reset: () => void;
}

const FEE_PCT = 0.005; // 0.5%
const DEMO_RATE = 83.5;

function isValidSubstrateAddress(value: string): boolean {
  try {
    decodeAddress(value);
    return true;
  } catch {
    return false;
  }
}

function toChainAmount(amount: string): bigint {
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid remittance amount");
  }

  return BigInt(Math.round(parsed * 1_000_000));
}

function createChainDeliveryMode(
  mode: DeliveryMode,
  recipientId: string,
): ChainDeliveryMode | null {
  switch (mode) {
    case "iinr":
      return { type: "CryptoWallet" };
    case "upi":
      return { type: "UpiInstant", upiId: recipientId };
    default:
      return null;
  }
}

function canUseSignedContractPath(deliveryMode: DeliveryMode, recipientId: string): boolean {
  if (deliveryMode === "iinr") {
    return isValidSubstrateAddress(recipientId);
  }

  return false;
}

async function submitViaApi(params: {
  senderAddress: string;
  recipientId: string;
  amount: string;
  currency: "USDC" | "USDT" | "DAI";
  deliveryMode: DeliveryMode;
}) {
  const { data } = await axios.post(`${API_BASE}/remittance`, {
    senderAddress: params.senderAddress,
    recipientId: params.recipientId,
    amount: parseFloat(params.amount),
    currency: params.currency,
    deliveryMode: params.deliveryMode,
  });

  return data?.data ?? data;
}

export const useRemittanceStore = create<RemittanceState>((set, get) => ({
  sendAmount: "200",
  sendCurrency: "USDC",
  recipientId: "",
  deliveryMode: "upi",
  fxRate: DEMO_RATE,
  receiveAmountInr: 200 * (1 - FEE_PCT) * DEMO_RATE,
  feePct: FEE_PCT * 100,
  orderId: null,
  orderStatus: null,
  contractStatus: null,
  utrNumber: null,
  txHash: null,
  integrationMode: null,
  contractContext: null,
  timeline: [],
  isSubmitting: false,
  error: null,

  setSendAmount: (v) => {
    const amt = parseFloat(v) || 0;
    const { fxRate } = get();
    set({
      sendAmount: v,
      receiveAmountInr: amt * (1 - FEE_PCT) * fxRate,
    });
  },

  setSendCurrency: (v) => set({ sendCurrency: v }),
  setRecipientId: (v) => set({ recipientId: v }),
  setDeliveryMode: (v) => set({ deliveryMode: v }),

  fetchFxRate: async () => {
    try {
      let rate = DEMO_RATE;

      try {
        const chainRate = await queryFxRate();
        rate = chainRate / 1_000_000;
      } catch {
        const { data } = await axios.get(`${API_BASE}/rates`);
        rate = data.rate ?? DEMO_RATE;
      }

      const amt = parseFloat(get().sendAmount) || 0;
      set({ fxRate: rate, receiveAmountInr: amt * (1 - FEE_PCT) * rate });
    } catch {
      // keep demo rate on error
    }
  },

  submitRemittance: async (senderAddress) => {
    const { sendAmount, sendCurrency, recipientId, deliveryMode } = get();
    set({ isSubmitting: true, error: null });

    try {
      if (canUseSignedContractPath(deliveryMode, recipientId)) {
        try {
          const api = await getPolkadotApi();
          const amount = toChainAmount(sendAmount);
          const chainDeliveryMode = createChainDeliveryMode(deliveryMode, recipientId);

          if (!chainDeliveryMode) {
            throw new Error("This delivery mode is not yet mapped to the on-chain pallet.");
          }

          const extrinsic = buildInitiateRemittance(
            api,
            recipientId,
            ASSET_IDS[sendCurrency],
            amount,
            chainDeliveryMode,
          );
          const receipt = await submitWithInjectedSigner(extrinsic, senderAddress);
          const fxRateScaled = await queryFxRate().catch(() => Math.round(get().fxRate * 1_000_000));
          const amountOutInrPaise = Math.round(parseFloat(sendAmount || "0") * get().fxRate * 100 * (1 - FEE_PCT));

          set({
            orderId: receipt.txHash,
            txHash: receipt.txHash,
            orderStatus: "RateLocked",
            contractStatus: receipt.status,
            integrationMode: "contracts",
            contractContext: {
              chainId: "polkasend-para-3000",
              paraId: 3000,
              palletCall: "remittance.initiate_remittance",
              args: {
                recipient: recipientId,
                assetId: ASSET_IDS[sendCurrency],
                amount: amount.toString(),
                deliveryMode,
              },
              quote: {
                fxRateScaled,
                amountOutInrPaise,
                feeBps: 50,
              },
            },
            timeline: [
              {
                type: "wallet_submitted",
                message: "Signed remittance extrinsic submitted from the connected Substrate wallet.",
                timestamp: new Date().toISOString(),
                data: {
                  txHash: receipt.txHash,
                  blockHash: receipt.blockHash ?? null,
                  status: receipt.status,
                },
              },
            ],
            isSubmitting: false,
          });
          return;
        } catch {
          // fall through to existing API-backed flow
        }
      }

      const payload = await submitViaApi({
        senderAddress,
        recipientId,
        amount: sendAmount,
        currency: sendCurrency,
        deliveryMode,
      });
      const resolvedOrderId = payload?.orderId ?? payload?.id;
      const resolvedTxHash = payload?.txHash ?? null;

      if (!resolvedOrderId) {
        throw new Error("Order ID missing in remittance response");
      }

      set({
        orderId: resolvedOrderId,
        txHash: resolvedTxHash,
        orderStatus: (payload?.status as ClientOrderStatus | undefined) ?? "RateLocked",
        contractStatus: payload?.contractStatus ?? null,
        integrationMode: payload?.integrationMode ?? null,
        contractContext: payload?.contract ?? null,
        timeline: payload?.timeline ?? [],
        isSubmitting: false,
      });

      // Start polling
      get().pollOrderStatus(resolvedOrderId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      set({ error: msg, isSubmitting: false });
    }
  },

  pollOrderStatus: async (orderId) => {
    const poll = async () => {
      if (get().orderId !== orderId) return;

      try {
        const { data } = await axios.get(`${API_BASE}/remittance`, {
          params: { orderId },
        });
        set({
          orderStatus: (data.status as ClientOrderStatus | undefined) ?? null,
          contractStatus: data.contractStatus ?? null,
          utrNumber: data.utrNumber ?? null,
          integrationMode: data.integrationMode ?? null,
          contractContext: data.contract ?? null,
          timeline: data.timeline ?? [],
        });
        if (data.status !== "Completed" && data.status !== "Failed") {
          setTimeout(poll, 3000);
        }
      } catch {
        setTimeout(poll, 5000);
      }
    };
    poll();
  },

  reset: () =>
    set({
      orderId: null,
      orderStatus: null,
      contractStatus: null,
      utrNumber: null,
      txHash: null,
      integrationMode: null,
      contractContext: null,
      timeline: [],
      isSubmitting: false,
      error: null,
    }),
}));
