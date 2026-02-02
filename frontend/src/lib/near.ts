import { CONTRACT_IDS, nearConfig } from "../config/near";

/**
 * Call a view method on a contract using fetch
 */
export async function viewMethod<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch(nearConfig.nodeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC Error");
  }

  const resultBytes = data.result.result;
  const resultString = String.fromCharCode(...resultBytes);
  return JSON.parse(resultString) as T;
}

/**
 * Get contract instance helpers
 */
export const invoiceContract = {
  getInvoice: (invoiceId: string) =>
    viewMethod(CONTRACT_IDS.invoice, "get_invoice", { invoice_id: invoiceId }),

  getInvoicesByCreator: (accountId: string) =>
    viewMethod(CONTRACT_IDS.invoice, "get_invoices_by_creator", {
      account_id: accountId,
    }),

  getInvoicesByOwner: (accountId: string) =>
    viewMethod(CONTRACT_IDS.invoice, "get_invoices_by_owner", {
      account_id: accountId,
    }),

  getAllInvoices: (fromIndex: number = 0, limit: number = 50) =>
    viewMethod(CONTRACT_IDS.invoice, "get_all_invoices", {
      from_index: fromIndex,
      limit,
    }),

  getInvoiceCount: () =>
    viewMethod<number>(CONTRACT_IDS.invoice, "get_invoice_count", {}),
};

export const marketplaceContract = {
  getActiveListings: (fromIndex: number = 0, limit: number = 50) =>
    viewMethod(CONTRACT_IDS.marketplace, "get_active_listings", {
      from_index: fromIndex,
      limit,
    }),

  getListing: (listingId: string) =>
    viewMethod(CONTRACT_IDS.marketplace, "get_listing", { listing_id: listingId }),

  getBids: (listingId: string) =>
    viewMethod(CONTRACT_IDS.marketplace, "get_bids", { listing_id: listingId }),

  getListingsBySeller: (seller: string) =>
    viewMethod(CONTRACT_IDS.marketplace, "get_listings_by_seller", { seller }),
};

export const escrowContract = {
  getEscrow: (escrowId: string) =>
    viewMethod(CONTRACT_IDS.escrow, "get_escrow", { escrow_id: escrowId }),

  getEscrowByInvoice: (invoiceId: string) =>
    viewMethod(CONTRACT_IDS.escrow, "get_escrow_by_invoice", {
      invoice_id: invoiceId,
    }),

  getEscrowsByBuyer: (buyer: string) =>
    viewMethod(CONTRACT_IDS.escrow, "get_escrows_by_buyer", { buyer }),

  getEscrowsBySeller: (seller: string) =>
    viewMethod(CONTRACT_IDS.escrow, "get_escrows_by_seller", { seller }),

  getActiveEscrows: () =>
    viewMethod(CONTRACT_IDS.escrow, "get_active_escrows", {}),
};
