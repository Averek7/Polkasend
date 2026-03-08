import { create } from "zustand";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type DeliveryMode = "upi" | "imps" | "iinr" | "aadhaar";

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
  orderStatus: string | null;
  utrNumber: string | null;
  txHash: string | null;
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
  utrNumber: null,
  txHash: null,
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

      set({
        orderId: data.orderId,
        txHash: data.txHash,
        orderStatus: "RateLocked",
        isSubmitting: false,
      });

      // Start polling
      get().pollOrderStatus(data.orderId);
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
        set({ orderStatus: data.status, utrNumber: data.utrNumber ?? null });
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
      utrNumber: null,
      txHash: null,
      isSubmitting: false,
      error: null,
    }),
}));
