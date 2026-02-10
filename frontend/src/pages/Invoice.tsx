import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  ExternalLink,
  Clock,
  Shield,
  TrendingUp,
  User,
  Mail,
  AlertCircle,
  Loader2,
  Wallet,
} from "lucide-react";
import { Button } from "../components/common/Button";
import { Modal } from "../components/common/Modal";
import { StatusBadge } from "../components/common/StatusBadge";
import { useWalletStore } from "../stores/walletStore";
import { useMarketplace } from "../hooks/useMarketplace";
import { useUSDCToken } from "../hooks/useUSDCToken";
import { CONTRACT_IDS } from "../config/near";
import {
  formatUSDC,
  formatDate,
  getDaysUntil,
  calculateDiscount,
  calculateAPY,
  getRiskLevel,
} from "../lib/format";
import type { Invoice as InvoiceType, Listing } from "../types";

export function Invoice() {
  const { id: invoiceId } = useParams();
  const navigate = useNavigate();
  const { isConnected, connect, accountId } = useWalletStore();
  const { buyInvoice } = useMarketplace();
  const { balance: usdcBalance, fetchBalance: fetchUSDCBalance, formatUSDC: formatUSDCBalance } = useUSDCToken();

  const [invoice, setInvoice] = useState<InvoiceType | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);

  // Fetch USDC balance when connected
  useEffect(() => {
    if (isConnected && accountId) {
      fetchUSDCBalance();
    }
  }, [isConnected, accountId, fetchUSDCBalance]);

  // Fetch invoice and listing data
  const fetchData = useCallback(async () => {
    if (!invoiceId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch invoice
      const invoiceResponse = await fetch(`https://rpc.testnet.near.org`, {
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

      const invoiceData = await invoiceResponse.json();
      if (invoiceData.result?.result) {
        const resultString = String.fromCharCode(...invoiceData.result.result);
        const invoiceResult = JSON.parse(resultString);
        if (invoiceResult) {
          setInvoice(invoiceResult);
        } else {
          setError("Invoice not found");
          return;
        }
      }

      // Fetch listing for this invoice
      const listingResponse = await fetch(`https://rpc.testnet.near.org`, {
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

      const listingData = await listingResponse.json();
      if (listingData.result?.result) {
        const resultString = String.fromCharCode(...listingData.result.result);
        const listingResult = JSON.parse(resultString);
        if (listingResult) {
          setListing(listingResult);
        }
      }
    } catch (err) {
      console.error("Failed to fetch invoice:", err);
      setError("Failed to load invoice data");
    } finally {
      setIsLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
          <p className="text-neutral-400">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-neutral-50 mb-2">
            {error || "Invoice not found"}
          </h2>
          <Link to="/marketplace">
            <Button variant="outline">Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const daysUntilDue = getDaysUntil(invoice.due_date);
  const askingPrice = listing?.asking_price || invoice.amount;
  const discount = calculateDiscount(
    Number(invoice.amount),
    Number(askingPrice)
  );
  const apy = calculateAPY(discount, daysUntilDue);
  const risk = getRiskLevel(invoice.risk_score);
  const profit = Number(invoice.amount) - Number(askingPrice);
  const isOwner = accountId === invoice.owner;
  const isListed = invoice.status === "Listed" && listing?.active;

  return (
    <div className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          to="/marketplace"
          className="inline-flex items-center text-neutral-400 hover:text-neutral-200 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Marketplace
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-2xl font-bold text-neutral-50">
                      {invoice.id}
                    </h1>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <p className="text-neutral-400">
                    Created by{" "}
                    <span className="font-medium text-neutral-50">
                      {invoice.creator}
                    </span>
                  </p>
                </div>
              </div>

              <hr className="my-4 border-white/10" />

              {/* Debtor Info */}
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="w-5 h-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Debtor</p>
                    <p className="font-medium text-neutral-50">
                      {invoice.debtor_name}
                    </p>
                  </div>
                </div>
                {invoice.debtor_email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-neutral-400" />
                    <div>
                      <p className="text-sm text-neutral-500">Contact</p>
                      <p className="font-medium text-neutral-50">
                        {invoice.debtor_email}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <Clock className="w-5 h-5 text-neutral-400" />
                  <div>
                    <p className="text-sm text-neutral-500">Due Date</p>
                    <p className="font-medium text-neutral-50">
                      {formatDate(invoice.due_date)} ({daysUntilDue} days)
                    </p>
                  </div>
                </div>
              </div>

              <hr className="my-4 border-white/10" />

              {/* Description */}
              <div>
                <h3 className="font-medium text-neutral-50 mb-2">
                  Description
                </h3>
                <p className="text-neutral-400">{invoice.description}</p>
              </div>

              {/* Document */}
              <div className="mt-4">
                <button className="inline-flex items-center space-x-2 text-primary-400 hover:text-primary-300">
                  <FileText className="w-4 h-4" />
                  <span>View Invoice PDF</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <p className="text-xs text-neutral-400 mt-1">
                  IPFS: {invoice.documents_hash}
                </p>
              </div>
            </div>

            {/* Risk Assessment Card */}
            <div className="glass-card rounded-xl p-6">
              <h3 className="font-semibold text-neutral-50 mb-4 flex items-center">
                <Shield className="w-5 h-5 mr-2 text-neutral-400" />
                Risk Assessment
              </h3>

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-neutral-500">Risk Level</p>
                  <p className={`text-lg font-semibold ${risk.color}`}>
                    {risk.emoji} {risk.label} Risk
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500">Score</p>
                  <p className="text-lg font-semibold text-neutral-50">
                    {invoice.risk_score}/100
                  </p>
                </div>
              </div>

              {/* Risk Bar */}
              <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    invoice.risk_score <= 33
                      ? "bg-emerald-400"
                      : invoice.risk_score <= 66
                      ? "bg-amber-400"
                      : "bg-red-400"
                  }`}
                  style={{ width: `${invoice.risk_score}%` }}
                />
              </div>

              <div className="mt-4 text-sm text-neutral-400 space-y-1">
                <p>
                  {invoice.risk_score <= 33
                    ? "- Low risk profile based on amount and due date"
                    : invoice.risk_score <= 66
                    ? "- Medium risk: moderate invoice value"
                    : "- Higher risk: larger amount or longer term"}
                </p>
                <p>- Invoice amount: {formatUSDC(invoice.amount)}</p>
                <p>- Payment terms: {daysUntilDue} days until due</p>
              </div>
            </div>
          </div>

          {/* Purchase Card */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-xl p-6 sticky top-24">
              {isOwner ? (
                <>
                  <h3 className="font-semibold text-neutral-50 mb-4">
                    Your Invoice
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Invoice Value</span>
                      <span className="font-semibold text-neutral-50">
                        {formatUSDC(invoice.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Status</span>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                </>
              ) : isListed && listing ? (
                <>
                  <h3 className="font-semibold text-neutral-50 mb-4">
                    Purchase This Invoice
                  </h3>

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Invoice Value</span>
                      <span className="font-semibold text-neutral-50">
                        {formatUSDC(invoice.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Asking Price</span>
                      <span className="font-semibold text-primary-400">
                        {formatUSDC(listing.asking_price)}
                      </span>
                    </div>
                    <hr className="border-white/10" />
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Your Discount</span>
                      <span className="font-semibold text-emerald-400">
                        {formatUSDC(profit)} ({discount.toFixed(1)}%)
                      </span>
                    </div>
                  </div>

                  {/* Yield Banner */}
                  <div className="bg-gradient-to-r from-primary-500/10 to-primary-500/5 border border-primary-500/20 rounded-lg p-4 mt-4">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-5 h-5 text-primary-400" />
                      <span className="font-semibold text-primary-300">
                        Annualized Yield
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-primary-300">
                      ~{apy.toFixed(0)}% APY
                    </p>
                    <p className="text-sm text-primary-400 mt-1">
                      Based on {discount.toFixed(1)}% in {daysUntilDue} days
                    </p>
                  </div>

                  {/* USDC Balance */}
                  {isConnected && (
                    <div className="bg-surface-2 border border-white/5 rounded-lg p-3 mt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Wallet className="w-4 h-4 text-neutral-400" />
                          <span className="text-sm text-neutral-400">Your USDC Balance</span>
                        </div>
                        <span className="font-medium text-neutral-50">
                          ${formatUSDCBalance(usdcBalance)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Buy Button */}
                  <div className="mt-6">
                    {isConnected ? (
                      BigInt(usdcBalance) >= BigInt(listing.asking_price) ? (
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => setBuyModalOpen(true)}
                        >
                          Buy for {formatUSDC(listing.asking_price)}
                        </Button>
                      ) : (
                        <div>
                          <Button className="w-full" size="lg" disabled>
                            Insufficient USDC Balance
                          </Button>
                          <p className="text-xs text-neutral-500 mt-2 text-center">
                            You need {formatUSDC(listing.asking_price)} USDC to buy this invoice.
                            Get testnet USDC from the faucet.
                          </p>
                        </div>
                      )
                    ) : (
                      <Button className="w-full" size="lg" onClick={connect}>
                        Connect Wallet to Buy
                      </Button>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 mt-4 flex items-start">
                    <AlertCircle className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5" />
                    Funds held in escrow until debtor pays. If debtor defaults, you
                    may open a dispute.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-neutral-50 mb-4">
                    Invoice Details
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Invoice Value</span>
                      <span className="font-semibold text-neutral-50">
                        {formatUSDC(invoice.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Status</span>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500 mt-4">
                    This invoice is not currently listed for sale.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buy Modal */}
      {listing && (
        <BuyModal
          isOpen={buyModalOpen}
          onClose={() => setBuyModalOpen(false)}
          invoice={invoice}
          listing={listing}
          onBuy={buyInvoice}
          onSuccess={() => navigate("/dashboard")}
        />
      )}
    </div>
  );
}

function BuyModal({
  isOpen,
  onClose,
  invoice,
  listing,
  onBuy,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceType;
  listing: Listing;
  onBuy: (listingId: string, priceAmount: string) => Promise<string | null>;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"confirm" | "buying" | "success" | "error">(
    "confirm"
  );
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBuy = async () => {
    setStep("buying");
    setErrorMessage(null);

    try {
      // Pass both listing ID and price amount for USDC ft_transfer_call
      const result = await onBuy(listing.id, listing.asking_price);
      if (result) {
        setTxHash(result);
        setStep("success");
      } else {
        setErrorMessage("Transaction failed. Please try again.");
        setStep("error");
      }
    } catch (err) {
      console.error("Purchase failed:", err);
      setErrorMessage("An error occurred. Please try again.");
      setStep("error");
    }
  };

  const handleClose = () => {
    if (step === "success") {
      onSuccess();
    }
    setStep("confirm");
    setTxHash(null);
    setErrorMessage(null);
    onClose();
  };

  const discount = calculateDiscount(
    Number(invoice.amount),
    Number(listing.asking_price)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === "success" ? "Purchase Complete!" : step === "error" ? "Purchase Failed" : "Confirm Purchase"}
      size="md"
    >
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="bg-surface-2 border border-white/5 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className="text-neutral-400">Invoice</span>
              <span className="font-medium text-neutral-50">{invoice.id}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-neutral-400">Debtor</span>
              <span className="font-medium text-neutral-50">{invoice.debtor_name}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-neutral-400">Invoice Value</span>
              <span className="font-medium text-neutral-50">{formatUSDC(invoice.amount)}</span>
            </div>
            <hr className="my-2 border-white/10" />
            <div className="flex justify-between">
              <span className="text-neutral-50 font-semibold">You Pay</span>
              <span className="text-primary-400 font-bold">
                {formatUSDC(listing.asking_price)}
              </span>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <p className="text-emerald-300 text-sm">
              You will earn{" "}
              <span className="font-semibold">
                {formatUSDC(Number(invoice.amount) - Number(listing.asking_price))}
              </span>{" "}
              ({discount.toFixed(1)}%) when the debtor pays.
            </p>
          </div>

          <p className="text-sm text-neutral-500">
            By proceeding, you agree to lock your USDC in escrow until the
            invoice is settled or disputed.
          </p>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleBuy}>Confirm Purchase</Button>
          </div>
        </div>
      )}

      {step === "buying" && (
        <div className="text-center py-8">
          <div className="animate-spin w-12 h-12 border-4 border-primary-800 border-t-primary-400 rounded-full mx-auto mb-4" />
          <p className="text-lg font-semibold text-neutral-50">
            Processing Purchase...
          </p>
          <p className="text-neutral-400 mt-2">
            Please confirm the transaction in your wallet
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-neutral-50">
            Invoice Purchased!
          </p>
          <p className="text-neutral-400 mt-2">
            You now own {invoice.id}. Funds are held in escrow until the debtor
            pays.
          </p>
          {txHash && (
            <a
              href={`https://testnet.nearblocks.io/txns/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-primary-400 hover:text-primary-300 mt-3"
            >
              View transaction <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          )}
          <div className="mt-6">
            <Button onClick={handleClose}>View My Investments</Button>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-lg font-semibold text-neutral-50">
            Purchase Failed
          </p>
          <p className="text-neutral-400 mt-2">
            {errorMessage || "Something went wrong. Please try again."}
          </p>
          <div className="mt-6 flex justify-center space-x-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep("confirm")}>Try Again</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
