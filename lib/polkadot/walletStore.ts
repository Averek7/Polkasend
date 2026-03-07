import { create } from 'zustand';

interface WalletState {
  address: string | null;
  name: string | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  name: null,
  isConnecting: false,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      // Dynamic import to avoid SSR issues
      const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp');
      const extensions = await web3Enable('PolkaSend');

      if (extensions.length === 0) {
        // Fallback: simulate wallet for demo
        await new Promise(r => setTimeout(r, 800));
        set({
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
          name: 'Demo Wallet',
          isConnecting: false,
        });
        return;
      }

      const accounts = await web3Accounts();
      if (accounts.length === 0) throw new Error('No accounts found');

      set({
        address: accounts[0].address,
        name: accounts[0].meta.name ?? null,
        isConnecting: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      // Fallback demo mode
      set({
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        name: 'Demo Wallet',
        isConnecting: false,
        error: message,
      });
    }
  },

  disconnect: () => set({ address: null, name: null, error: null }),
}));
