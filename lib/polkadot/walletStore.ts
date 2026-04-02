import { create } from 'zustand';
import { clearActiveInjectedSigner, ensureInjectedSigner } from './signer';

const APP_NAME = 'PolkaSend';
const STORAGE_KEY = 'polkasend.wallet-selection';

type InjectedAccount = {
  address: string;
  meta: {
    name?: string;
    source?: string;
  };
};

type InjectedExtension = {
  name: string;
};

export interface WalletProvider {
  id: string;
  name: string;
  family: WalletFamily;
  status: 'available' | 'planned';
  role: 'operational' | 'funding';
  description: string;
}

export interface WalletAccount {
  address: string;
  name: string | null;
  source: string;
}

export type WalletFamily = 'substrate' | 'evm' | 'svm';

interface WalletState {
  address: string | null;
  name: string | null;
  walletId: string | null;
  walletName: string | null;
  walletFamily: WalletFamily | null;
  canSign: boolean;
  isConnecting: boolean;
  error: string | null;
  modalOpen: boolean;
  initialized: boolean;
  wallets: WalletProvider[];
  accounts: WalletAccount[];
  selectedWalletId: string | null;
  connect: () => Promise<void>;
  initialize: () => Promise<void>;
  closeModal: () => void;
  selectWallet: (walletId: string) => Promise<void>;
  resetSelection: () => void;
  selectAccount: (address: string) => void;
  disconnect: () => void;
}

function prettifyWalletName(source: string): string {
  const known: Record<string, string> = {
    'polkadot-js': 'Polkadot.js',
    talisman: 'Talisman',
    'subwallet-js': 'SubWallet',
    enkrypt: 'Enkrypt',
    nova: 'Nova Wallet',
    fearlesswallet: 'Fearless Wallet',
  };

  return known[source] ?? source.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const PLANNED_WALLETS: WalletProvider[] = [
  {
    id: 'metamask',
    name: 'MetaMask',
    family: 'evm',
    status: 'planned',
    role: 'funding',
    description: 'Planned funding rail for EVM-based stablecoin deposits.',
  },
  {
    id: 'rabby',
    name: 'Rabby',
    family: 'evm',
    status: 'planned',
    role: 'funding',
    description: 'Planned funding rail for power users on Ethereum-compatible chains.',
  },
  {
    id: 'walletconnect',
    name: 'WalletConnect',
    family: 'evm',
    status: 'planned',
    role: 'funding',
    description: 'Planned mobile funding route for EVM wallets.',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    family: 'svm',
    status: 'planned',
    role: 'funding',
    description: 'Planned Solana funding rail for USDC-based intake.',
  },
  {
    id: 'solflare',
    name: 'Solflare',
    family: 'svm',
    status: 'planned',
    role: 'funding',
    description: 'Planned Solana wallet support for secondary funding flows.',
  },
];

async function getExtensionApi() {
  const { web3Accounts, web3Enable } = await import('@polkadot/extension-dapp');
  return { web3Accounts, web3Enable };
}

async function discoverWallets() {
  const { web3Enable } = await getExtensionApi();
  const extensions = (await web3Enable(APP_NAME)) as InjectedExtension[];

  const wallets = extensions.map((extension) => ({
    id: extension.name,
    name: prettifyWalletName(extension.name),
    family: 'substrate' as const,
    status: 'available' as const,
    role: 'operational' as const,
    description: 'Operational wallet for Substrate calls, KYC, and remittance execution.',
  }));

  return [...wallets, ...PLANNED_WALLETS];
}

async function discoverAccounts(walletId: string) {
  const { web3Accounts } = await getExtensionApi();
  const accounts = (await web3Accounts()) as InjectedAccount[];

  return accounts
    .filter((account) => account.meta.source === walletId)
    .map((account) => ({
      address: account.address,
      name: account.meta.name ?? null,
      source: account.meta.source ?? walletId,
    }));
}

function persistSelection(selection: {
  address: string;
  name: string | null;
  walletId: string;
  walletName: string;
  walletFamily: WalletFamily;
}) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
}

function clearPersistedSelection() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  name: null,
  walletId: null,
  walletName: null,
  walletFamily: null,
  canSign: false,
  isConnecting: false,
  error: null,
  modalOpen: false,
  initialized: false,
  wallets: [],
  accounts: [],
  selectedWalletId: null,

  connect: async () => {
    set({
      isConnecting: true,
      error: null,
      modalOpen: true,
      accounts: [],
      selectedWalletId: null,
    });

    try {
      const wallets = await discoverWallets();
      const operationalWallets = wallets.filter(
        (wallet) => wallet.family === 'substrate' && wallet.status === 'available',
      );

      if (operationalWallets.length === 0) {
        set({
          wallets: PLANNED_WALLETS,
          isConnecting: false,
          error:
            'No supported Polkadot wallet extension was found. Install Talisman, SubWallet, or Polkadot.js.',
        });
        return;
      }

      set({
        wallets,
        isConnecting: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Wallet discovery failed';
      set({
        wallets: [],
        isConnecting: false,
        error: message,
      });
    }
  },

  initialize: async () => {
    if (get().initialized || typeof window === 'undefined') {
      return;
    }

    set({ initialized: true });

    const rawSelection = window.localStorage.getItem(STORAGE_KEY);
    if (!rawSelection) {
      return;
    }

    try {
      const saved = JSON.parse(rawSelection) as {
        address: string;
        name: string | null;
        walletId: string;
        walletName: string;
        walletFamily: WalletFamily;
      };

      const wallets = await discoverWallets();
      const wallet = wallets.find(
        (candidate) => candidate.id === saved.walletId && candidate.family === saved.walletFamily,
      );

      if (!wallet || wallet.family !== 'substrate') {
        clearPersistedSelection();
        return;
      }

      const accounts = await discoverAccounts(saved.walletId);
      const account = accounts.find((candidate) => candidate.address === saved.address);

      if (!account) {
        clearPersistedSelection();
        return;
      }

      await ensureInjectedSigner(account.source);

      set({
        wallets,
        accounts: [],
        address: account.address,
        name: account.name,
        walletId: account.source,
        walletName: wallet.name,
        walletFamily: 'substrate',
        canSign: true,
        error: null,
      });
    } catch {
      clearPersistedSelection();
      clearActiveInjectedSigner();
      set({
        address: null,
        name: null,
        walletId: null,
        walletName: null,
        walletFamily: null,
        canSign: false,
      });
    }
  },

  closeModal: () =>
    set({
      modalOpen: false,
      isConnecting: false,
      error: null,
      accounts: [],
      selectedWalletId: null,
    }),

  selectWallet: async (walletId: string) => {
    const wallet = get().wallets.find((candidate) => candidate.id === walletId);

    if (!wallet) {
      set({ error: 'Selected wallet could not be found.' });
      return;
    }

    if (wallet.family !== 'substrate' || wallet.status !== 'available') {
      set({
        error:
          wallet.family === 'evm'
            ? 'EVM wallets are planned as funding rails and are not connected yet.'
            : 'Solana wallets are planned as funding rails and are not connected yet.',
      });
      return;
    }

    set({
      isConnecting: true,
      error: null,
      selectedWalletId: walletId,
      accounts: [],
    });

    try {
      const accounts = await discoverAccounts(walletId);

      if (accounts.length === 0) {
        set({
          isConnecting: false,
          error: `No accounts were found in ${wallet?.name ?? prettifyWalletName(walletId)}.`,
        });
        return;
      }

      if (accounts.length === 1) {
        const account = accounts[0];
        await ensureInjectedSigner(account.source);
        persistSelection({
          address: account.address,
          name: account.name,
          walletId: account.source,
          walletName: wallet?.name ?? prettifyWalletName(walletId),
          walletFamily: 'substrate',
        });
        set({
          address: account.address,
          name: account.name,
          walletId: account.source,
          walletName: wallet?.name ?? prettifyWalletName(walletId),
          walletFamily: 'substrate',
          canSign: true,
          accounts: [],
          selectedWalletId: null,
          modalOpen: false,
          isConnecting: false,
          error: null,
        });
        return;
      }

      set({
        accounts,
        isConnecting: false,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Account discovery failed';
      set({
        isConnecting: false,
        error: message,
      });
    }
  },

  resetSelection: () =>
    set({
      accounts: [],
      selectedWalletId: null,
      error: null,
    }),

  selectAccount: (address: string) => {
    const state = get();
    const account = state.accounts.find((candidate) => candidate.address === address);
    const wallet = state.wallets.find((candidate) => candidate.id === state.selectedWalletId);

    if (!account) {
      set({ error: 'Selected account could not be found.' });
      return;
    }

    persistSelection({
      address: account.address,
      name: account.name,
      walletId: account.source,
      walletName: wallet?.name ?? prettifyWalletName(account.source),
      walletFamily: 'substrate',
    });

    set({ isConnecting: true, error: null });

    ensureInjectedSigner(account.source)
      .then(() => {
        set({
          address: account.address,
          name: account.name,
          walletId: account.source,
          walletName: wallet?.name ?? prettifyWalletName(account.source),
          walletFamily: 'substrate',
          canSign: true,
          modalOpen: false,
          accounts: [],
          selectedWalletId: null,
          isConnecting: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Signer could not be initialized.';
        set({
          canSign: false,
          isConnecting: false,
          error: message,
        });
      });
  },

  disconnect: () => {
    clearPersistedSelection();
    clearActiveInjectedSigner();
    set({
      address: null,
      name: null,
      walletId: null,
      walletName: null,
      walletFamily: null,
      canSign: false,
      error: null,
      modalOpen: false,
      accounts: [],
      selectedWalletId: null,
      isConnecting: false,
    });
  },
}));
