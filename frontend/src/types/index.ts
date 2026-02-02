export type InvoiceStatus =
  | "Draft"
  | "Listed"
  | "Sold"
  | "Settled"
  | "Disputed"
  | "Cancelled";

export interface Invoice {
  id: string;
  creator: string;
  owner: string;
  amount: string;
  currency: string;
  debtor_name: string;
  debtor_email?: string;
  description: string;
  due_date: number;
  created_at: number;
  documents_hash: string;
  status: InvoiceStatus;
  risk_score: number;
}

export interface Listing {
  id: string;
  invoice_id: string;
  seller: string;
  asking_price: string;
  invoice_amount: string;
  due_date: number;
  min_price?: string;
  created_at: number;
  expires_at?: number;
  active: boolean;
}

export interface ListingWithInvoice {
  listing: Listing;
  invoice: Invoice;
  discount_percentage: number;
  days_until_due: number;
}

export type EscrowStatus = "Active" | "Released" | "Disputed" | "Refunded";

export interface EscrowEntry {
  id: string;
  invoice_id: string;
  seller: string;
  buyer: string;
  sale_amount: string;
  invoice_amount: string;
  created_at: number;
  due_date: number;
  status: EscrowStatus;
  settled_at?: number;
  dispute_reason?: string;
}

export interface EscrowStats {
  total_escrows: number;
  active_escrows: number;
  total_value_locked: string;
  total_settled: number;
  total_disputed: number;
}

export interface CreateInvoiceParams {
  amount: string;
  debtor_name: string;
  debtor_email?: string;
  description: string;
  due_date: number;
  documents_hash: string;
}

export interface ListInvoiceParams {
  invoice_id: string;
  asking_price: string;
  min_price?: string;
  expires_at?: number;
}
