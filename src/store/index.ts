import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletAccount, KycRecord, KycLevel, ChainStatus } from "@/types";

interface WalletState {
  account: WalletAccount | null;
  isConnecting: boolean;
  kycRecord: KycRecord | null;

  setAccount: (account: WalletAccount | null) => void;
  setConnecting: (v: boolean) => void;
  setKycRecord: (record: KycRecord | null) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      account: null,
      isConnecting: false,
      kycRecord: null,

      setAccount: (account) => set({ account }),
      setConnecting: (isConnecting) => set({ isConnecting }),
      setKycRecord: (kycRecord) => set({ kycRecord }),
      disconnect: () => set({ account: null, kycRecord: null }),
    }),
    {
      name: "polkasend-wallet",
      partialize: (s) => ({ account: s.account, kycRecord: s.kycRecord }),
    }
  )
);

interface ChainState {
  status: ChainStatus | null;
  lastUpdated: Date | null;
  setStatus: (status: ChainStatus) => void;
}

export const useChainStore = create<ChainState>()((set) => ({
  status: null,
  lastUpdated: null,
  setStatus: (status) => set({ status, lastUpdated: new Date() }),
}));

interface SendState {
  sendAmount: string;
  selectedAsset: "USDC" | "USDT" | "DAI";
  recipientId: string;
  deliveryMode: "UPI_INSTANT" | "IMPS_NEFT" | "IINR_WALLET" | "AADHAAR_PAY";
  fxRate: number;

  setSendAmount: (v: string) => void;
  setSelectedAsset: (v: "USDC" | "USDT" | "DAI") => void;
  setRecipientId: (v: string) => void;
  setDeliveryMode: (v: "UPI_INSTANT" | "IMPS_NEFT" | "IINR_WALLET" | "AADHAAR_PAY") => void;
  setFxRate: (v: number) => void;
}

export const useSendStore = create<SendState>()((set) => ({
  sendAmount: "200",
  selectedAsset: "USDC",
  recipientId: "",
  deliveryMode: "UPI_INSTANT",
  fxRate: 83.5,

  setSendAmount: (sendAmount) => set({ sendAmount }),
  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),
  setRecipientId: (recipientId) => set({ recipientId }),
  setDeliveryMode: (deliveryMode) => set({ deliveryMode }),
  setFxRate: (fxRate) => set({ fxRate }),
}));
