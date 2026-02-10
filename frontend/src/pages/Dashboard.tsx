import { useState, useEffect } from "react";
import { Plus, FileText, DollarSign, Clock, TrendingUp } from "lucide-react";
import { useWalletStore } from "../stores/walletStore";
import { useInvoices } from "../hooks/useInvoices";
import { useMarketplace } from "../hooks/useMarketplace";
import { CONTRACT_IDS } from "../config/near";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { Input } from "../components/common/Input";
import { StatusBadge } from "../components/common/StatusBadge";
import { CrossChainAddresses } from "../components/near/CrossChainAddresses";
import {
  formatUSDC,
  formatDate,
  getDaysUntil,
  calculateDiscount,
} from "../lib/format";
import type { Invoice, InvoiceStatus } from "../types";

type TabType = "all" | InvoiceStatus;

export function Dashboard() {
  const { accountId, isConnected, connect } = useWalletStore();
  const { invoices, isCreating, fetchInvoicesByCreator, createInvoice } = useInvoices();
  const { listInvoice, cancelListing } = useMarketplace();

  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Fetch invoices when connected
  useEffect(() => {
    if (isConnected && accountId) {
      fetchInvoicesByCreator();
    }
  }, [isConnected, accountId, fetchInvoicesByCreator]);

  const filteredInvoices =
    activeTab === "all"
      ? invoices
      : invoices.filter((inv) => inv.status === activeTab);

  const stats = {
    total: invoices.length,
    totalValue: invoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
    listed: invoices.filter((inv) => inv.status === "Listed").length,
    sold: invoices.filter((inv) => inv.status === "Sold").length,
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "Draft", label: "Draft" },
    { id: "Listed", label: "Listed" },
    { id: "Sold", label: "Sold" },
    { id: "Settled", label: "Settled" },
  ];

  const handleCancelListing = async (invoiceId: string) => {
    try {
      // Look up the listing ID for this invoice from the marketplace contract
      const response = await fetch("https://rpc.testnet.near.org", {
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
            method_name: "get_listing_by_invoice",
            args_base64: btoa(JSON.stringify({ invoice_id: invoiceId })),
          },
        }),
      });
      const data = await response.json();
      if (!data.result?.result) {
        console.error("Listing not found for invoice:", invoiceId);
        return;
      }
      const resultString = String.fromCharCode(...data.result.result);
      const listing = JSON.parse(resultString);
      if (!listing) {
        console.error("Listing not found for invoice:", invoiceId);
        return;
      }

      const success = await cancelListing(listing.id);
      if (success) {
        // Update local invoice status back to Draft
        await fetchInvoicesByCreator();
      }
    } catch (err) {
      console.error("Failed to cancel listing:", err);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-50 mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-neutral-400 mb-6">
            Connect your NEAR wallet to manage your invoices
          </p>
          <Button onClick={connect}>Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-neutral-50">
              Welcome, {accountId}
            </h1>
            <p className="text-neutral-400 mt-1">
              Manage your invoices and track payments
            </p>
          </div>
          <Button className="mt-4 sm:mt-0" onClick={() => setCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Total Invoices</p>
                <p className="text-2xl font-bold text-neutral-50">
                  {stats.total}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Total Value</p>
                <p className="text-2xl font-bold text-neutral-50">
                  {formatUSDC(stats.totalValue)}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Listed</p>
                <p className="text-2xl font-bold text-neutral-50">
                  {stats.listed}
                </p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-neutral-400">Sold</p>
                <p className="text-2xl font-bold text-neutral-50">
                  {stats.sold}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-Chain Addresses - NEAR Native Feature */}
        <div className="mb-8">
          <CrossChainAddresses />
        </div>

        {/* Tabs */}
        <div className="border-b border-white/10 mb-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary-400 text-primary-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice List */}
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-xl">
              <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-400">No invoices found</p>
              <p className="text-sm text-neutral-500 mt-1">
                Create your first invoice to get started
              </p>
            </div>
          ) : (
            filteredInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="glass-card glass-card-hover rounded-xl p-6 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-semibold text-neutral-50">
                        {invoice.id}
                      </h3>
                      <StatusBadge status={invoice.status} />
                    </div>
                    <p className="text-neutral-300">
                      {formatUSDC(invoice.amount)} | {invoice.debtor_name} | Due:{" "}
                      {formatDate(invoice.due_date)} (
                      {getDaysUntil(invoice.due_date)} days)
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">
                      {invoice.description}
                    </p>
                  </div>
                  <div className="mt-4 sm:mt-0 sm:ml-4 flex space-x-2">
                    {invoice.status === "Draft" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setListModalOpen(true);
                        }}
                      >
                        List for Sale
                      </Button>
                    )}
                    {invoice.status === "Listed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelListing(invoice.id)}
                      >
                        Cancel Listing
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={createInvoice}
        isCreating={isCreating}
      />

      {/* List Invoice Modal */}
      <ListInvoiceModal
        isOpen={listModalOpen}
        onClose={() => {
          setListModalOpen(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onList={listInvoice}
      />
    </div>
  );
}

function CreateInvoiceModal({
  isOpen,
  onClose,
  onCreate,
  isCreating,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (params: {
    amount: string;
    debtor_name: string;
    debtor_email?: string;
    description: string;
    due_date: number;
    documents_hash: string;
  }) => Promise<string | null>;
  isCreating: boolean;
}) {
  const [formData, setFormData] = useState({
    amount: "",
    debtor_name: "",
    debtor_email: "",
    description: "",
    due_date: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert amount to USDC units (6 decimals)
    const amountInUnits = String(Math.floor(parseFloat(formData.amount) * 1_000_000));

    // Convert date to timestamp
    const dueDate = new Date(formData.due_date).getTime();

    // In production, upload file to IPFS first
    const documentsHash = file ? `Qm${Date.now().toString(36)}` : "QmPlaceholder";

    const result = await onCreate({
      amount: amountInUnits,
      debtor_name: formData.debtor_name,
      debtor_email: formData.debtor_email || undefined,
      description: formData.description,
      due_date: dueDate,
      documents_hash: documentsHash,
    });

    if (result) {
      // Reset form and close modal
      setFormData({
        amount: "",
        debtor_name: "",
        debtor_email: "",
        description: "",
        due_date: "",
      });
      setFile(null);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Invoice" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Invoice Amount (USDC)"
          type="number"
          step="0.01"
          placeholder="5000.00"
          value={formData.amount}
          onChange={(e) =>
            setFormData({ ...formData, amount: e.target.value })
          }
          required
        />
        <Input
          label="Debtor Name"
          placeholder="Acme Corporation"
          value={formData.debtor_name}
          onChange={(e) =>
            setFormData({ ...formData, debtor_name: e.target.value })
          }
          required
        />
        <Input
          label="Debtor Email (optional)"
          type="email"
          placeholder="accounts@acme.com"
          value={formData.debtor_email}
          onChange={(e) =>
            setFormData({ ...formData, debtor_email: e.target.value })
          }
        />
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-1">
            Description
          </label>
          <textarea
            className="w-full px-3 py-2 border border-neutral-700 rounded-lg bg-surface-2 text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            rows={3}
            placeholder="500 units of organic coffee beans delivered on Jan 15, 2025"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />
        </div>
        <Input
          label="Due Date"
          type="date"
          value={formData.due_date}
          onChange={(e) =>
            setFormData({ ...formData, due_date: e.target.value })
          }
          required
        />
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-1">
            Upload Invoice PDF
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full px-3 py-2 border border-neutral-700 rounded-lg bg-surface-2 text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            required
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isCreating}>
            Create Invoice
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ListInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onList,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onList: (params: {
    invoice_id: string;
    asking_price: string;
    invoice_amount: string;
    due_date: number;
    min_price?: string;
    expires_at?: number;
  }) => Promise<string | null>;
}) {
  const [askingPrice, setAskingPrice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!invoice) return null;

  const invoiceAmount = Number(invoice.amount) / 1_000_000;
  const price = parseFloat(askingPrice) || 0;
  const discount = calculateDiscount(invoiceAmount, price);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert asking price to USDC units
      const askingPriceUnits = String(Math.floor(price * 1_000_000));

      // List on marketplace (contract handles setting invoice status via cross-contract call)
      const result = await onList({
        invoice_id: invoice.id,
        asking_price: askingPriceUnits,
        invoice_amount: invoice.amount,
        due_date: invoice.due_date,
      });

      if (result) {
        setAskingPrice("");
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="List Invoice for Sale" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-surface-2 border border-white/5 rounded-lg p-4 mb-4">
          <p className="text-sm text-neutral-400">Invoice Value</p>
          <p className="text-2xl font-bold text-neutral-50">
            {formatUSDC(invoice.amount)}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            {invoice.debtor_name} - Due {formatDate(invoice.due_date)}
          </p>
        </div>

        <Input
          label="Asking Price (USDC)"
          type="number"
          step="0.01"
          placeholder={String(invoiceAmount * 0.925)}
          value={askingPrice}
          onChange={(e) => setAskingPrice(e.target.value)}
          helperText={
            price > 0
              ? `Discount: ${discount.toFixed(2)}% (${formatUSDC(
                  (invoiceAmount - price) * 1_000_000
                )} off)`
              : "Set a price below the invoice value"
          }
          required
        />

        {price > invoiceAmount && (
          <p className="text-sm text-danger-500">
            Asking price cannot exceed invoice value
          </p>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={price <= 0 || price > invoiceAmount}
          >
            List for Sale
          </Button>
        </div>
      </form>
    </Modal>
  );
}
