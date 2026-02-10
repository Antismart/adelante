import { useState, useCallback } from "react";
import { actionCreators } from "@near-js/transactions";
import { useWalletStore } from "../stores/walletStore";
import { useInvoiceStore } from "../stores/invoiceStore";
import { CONTRACT_IDS } from "../config/near";
import type { ListingWithInvoice, ListInvoiceParams, Invoice, Listing } from "../types";

const THIRTY_TGAS = BigInt("30000000000000");
const ONE_HUNDRED_TGAS = BigInt("100000000000000");
const DEPOSIT = BigInt("10000000000000000000000"); // 0.01 NEAR
const ONE_YOCTO = BigInt("1");

// Raw listing view from marketplace contract (without invoice data)
interface ListingView {
  listing: Listing;
  discount_percentage: number;
  days_until_due: number;
  annualized_yield: number;
}

// Helper to fetch a single invoice
async function fetchInvoice(invoiceId: string): Promise<Invoice | null> {
  try {
    const response = await fetch(`https://rpc.testnet.near.org`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONTRACT_IDS.invoice,
          method_name: "get_invoice",
          args_base64: btoa(JSON.stringify({ invoice_id: invoiceId })),
        },
      }),
    });

    const data = await response.json();
    if (data.result?.result) {
      const resultString = String.fromCharCode(...data.result.result);
      return JSON.parse(resultString);
    }
    return null;
  } catch {
    return null;
  }
}

export function useMarketplace() {
  const { selector, accountId } = useWalletStore();
  const { listings, setListings, removeListing } = useInvoiceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch listings from marketplace
      const response = await fetch(`https://rpc.testnet.near.org`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: CONTRACT_IDS.marketplace,
            method_name: "get_active_listings",
            args_base64: btoa(JSON.stringify({ from_index: 0, limit: 100 })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const listingViews: ListingView[] = JSON.parse(resultString);

        // Fetch invoice data for each listing in parallel
        const listingsWithInvoices: ListingWithInvoice[] = await Promise.all(
          listingViews.map(async (view) => {
            const invoice = await fetchInvoice(view.listing.invoice_id);

            // If invoice not found, create a placeholder with data from listing
            const invoiceData: Invoice = invoice || {
              id: view.listing.invoice_id,
              creator: view.listing.seller,
              owner: view.listing.seller,
              amount: view.listing.invoice_amount,
              currency: "USDC",
              debtor_name: "Unknown",
              description: "Invoice details unavailable",
              due_date: view.listing.due_date,
              created_at: view.listing.created_at,
              documents_hash: "",
              status: "Listed",
              risk_score: 50,
            };

            return {
              listing: view.listing,
              invoice: invoiceData,
              discount_percentage: view.discount_percentage,
              days_until_due: view.days_until_due,
            };
          })
        );

        setListings(listingsWithInvoices);
      }
    } catch (err) {
      console.error("Failed to fetch listings:", err);
      setError("Failed to fetch listings");
    } finally {
      setIsLoading(false);
    }
  }, [setListings]);

  const listInvoice = useCallback(
    async (params: ListInvoiceParams & { invoice_amount: string; due_date: number }): Promise<string | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const result = await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.marketplace,
          actions: [
            actionCreators.functionCall(
              "list_invoice",
              {
                invoice_id: params.invoice_id,
                asking_price: params.asking_price,
                invoice_amount: params.invoice_amount,
                due_date: params.due_date,
                min_price: params.min_price || null,
                expires_at: params.expires_at || null,
              },
              THIRTY_TGAS,
              DEPOSIT,
            ),
          ],
        });

        // Refresh listings
        await fetchActiveListings();

        return result?.transaction?.hash || null;
      } catch (err) {
        console.error("Failed to list invoice:", err);
        setError("Failed to list invoice");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchActiveListings]
  );

  const buyInvoice = useCallback(
    async (listingId: string, priceAmount: string): Promise<string | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        // Use ft_transfer_call to send USDC to marketplace with purchase message
        // The marketplace contract will receive the USDC via ft_on_transfer callback
        const result = await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.usdc,
          actions: [
            actionCreators.functionCall(
              "ft_transfer_call",
              {
                receiver_id: CONTRACT_IDS.marketplace,
                amount: priceAmount,
                memo: null,
                msg: `buy_listing:${listingId}`,
              },
              ONE_HUNDRED_TGAS,
              ONE_YOCTO,
            ),
          ],
        });

        removeListing(listingId);
        return result?.transaction?.hash || null;
      } catch (err) {
        console.error("Failed to buy invoice:", err);
        setError("Failed to buy invoice");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, removeListing]
  );

  const cancelListing = useCallback(
    async (listingId: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.marketplace,
          actions: [
            actionCreators.functionCall(
              "cancel_listing",
              { listing_id: listingId },
              THIRTY_TGAS,
              BigInt(0),
            ),
          ],
        });

        removeListing(listingId);
        return true;
      } catch (err) {
        console.error("Failed to cancel listing:", err);
        setError("Failed to cancel listing");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, removeListing]
  );

  return {
    listings,
    isLoading,
    error,
    fetchActiveListings,
    listInvoice,
    buyInvoice,
    cancelListing,
  };
}
