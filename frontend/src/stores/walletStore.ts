import { create } from "zustand";
import { setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { CONTRACT_IDS, NETWORK_ID } from "../config/near";

interface WalletState {
  selector: WalletSelector | null;
  accountId: string | null;
  isConnected: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  selector: null,
  accountId: null,
  isConnected: false,
  isLoading: true,

  initialize: async () => {
    try {
      const selector = await setupWalletSelector({
        network: NETWORK_ID,
        modules: [setupMyNearWallet()],
      });

      const state = selector.store.getState();
      const accounts = state.accounts;
      const accountId = accounts.length > 0 ? accounts[0].accountId : null;

      set({
        selector,
        accountId,
        isConnected: !!accountId,
        isLoading: false,
      });

      // Subscribe to account changes
      selector.store.observable.subscribe((state) => {
        const accounts = state.accounts;
        const accountId = accounts.length > 0 ? accounts[0].accountId : null;
        set({
          accountId,
          isConnected: !!accountId,
        });
      });
    } catch (error) {
      console.error("Failed to initialize wallet selector:", error);
      set({ isLoading: false });
    }
  },

  connect: async () => {
    const { selector } = get();
    if (!selector) return;

    const wallet = await selector.wallet("my-near-wallet");
    await wallet.signIn({
      contractId: CONTRACT_IDS.marketplace,
      accounts: [],
    });
  },

  disconnect: async () => {
    const { selector } = get();
    if (!selector) return;

    const wallet = await selector.wallet("my-near-wallet");
    await wallet.signOut();
    set({ accountId: null, isConnected: false });
  },
}));
