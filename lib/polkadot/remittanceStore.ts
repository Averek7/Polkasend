import { create } from "zustand";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

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
      const { data } = await axios.get(`${API_BASE}/rates`);
      const rate = data.rate ?? DEMO_RATE;
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
      const { data } = await axios.post(`${API_BASE}/remittance`, {
        senderAddress,
        recipientId,
        amount: parseFloat(sendAmount),
        currency: sendCurrency,
        deliveryMode,
      });
      const payload = data?.data ?? data;
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
