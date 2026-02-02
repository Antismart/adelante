import { create } from "zustand";
import type { Invoice, ListingWithInvoice, EscrowEntry } from "../types";

interface InvoiceState {
  invoices: Invoice[];
  listings: ListingWithInvoice[];
  escrows: EscrowEntry[];
  isLoading: boolean;
  error: string | null;

  setInvoices: (invoices: Invoice[]) => void;
  setListings: (listings: ListingWithInvoice[]) => void;
  setEscrows: (escrows: EscrowEntry[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  addListing: (listing: ListingWithInvoice) => void;
  removeListing: (id: string) => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
  invoices: [],
  listings: [],
  escrows: [],
  isLoading: false,
  error: null,

  setInvoices: (invoices) => set({ invoices }),
  setListings: (listings) => set({ listings }),
  setEscrows: (escrows) => set({ escrows }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addInvoice: (invoice) =>
    set((state) => ({ invoices: [...state.invoices, invoice] })),

  updateInvoice: (id, updates) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...updates } : inv
      ),
    })),

  addListing: (listing) =>
    set((state) => ({ listings: [...state.listings, listing] })),

  removeListing: (id) =>
    set((state) => ({
      listings: state.listings.filter((l) => l.listing.id !== id),
    })),
}));
