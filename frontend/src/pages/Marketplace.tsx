import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, TrendingUp, Clock, Shield, Loader2 } from "lucide-react";
import { useMarketplace } from "../hooks/useMarketplace";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import {
  formatUSDC,
  getDaysUntil,
  calculateDiscount,
  calculateAPY,
  getRiskLevel,
} from "../lib/format";
import type { ListingWithInvoice } from "../types";

type SortOption = "yield" | "amount" | "due_date" | "risk";

export function Marketplace() {
  const { listings, isLoading, error, fetchActiveListings } = useMarketplace();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("yield");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minAmount: "",
    maxAmount: "",
    minDiscount: "",
    maxDays: "",
  });

  // Fetch listings on mount
  useEffect(() => {
    fetchActiveListings();
  }, [fetchActiveListings]);

  // Filter and sort listings
  let filteredListings = listings.filter(
    (listing) =>
      listing.invoice.debtor_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      listing.invoice.description
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
  );

  // Apply advanced filters
  if (filters.minAmount) {
    const min = parseFloat(filters.minAmount) * 1_000_000;
    filteredListings = filteredListings.filter(
      (l) => Number(l.invoice.amount) >= min
    );
  }
  if (filters.maxAmount) {
    const max = parseFloat(filters.maxAmount) * 1_000_000;
    filteredListings = filteredListings.filter(
      (l) => Number(l.invoice.amount) <= max
    );
  }
  if (filters.minDiscount) {
    const minDiscount = parseFloat(filters.minDiscount);
    filteredListings = filteredListings.filter(
      (l) => l.discount_percentage >= minDiscount
    );
  }
  if (filters.maxDays) {
    const maxDays = parseInt(filters.maxDays);
    filteredListings = filteredListings.filter(
      (l) => l.days_until_due <= maxDays
    );
  }

  // Sort listings
  filteredListings = [...filteredListings].sort((a, b) => {
    switch (sortBy) {
      case "yield":
        return (
          calculateAPY(b.discount_percentage, b.days_until_due) -
          calculateAPY(a.discount_percentage, a.days_until_due)
        );
      case "amount":
        return Number(b.invoice.amount) - Number(a.invoice.amount);
      case "due_date":
        return a.days_until_due - b.days_until_due;
      case "risk":
        return a.invoice.risk_score - b.invoice.risk_score;
      default:
        return 0;
    }
  });

  const totalValue = filteredListings.reduce(
    (sum, l) => sum + Number(l.invoice.amount),
    0
  );
  const avgDiscount =
    filteredListings.length > 0
      ? filteredListings.reduce((sum, l) => sum + l.discount_percentage, 0) /
        filteredListings.length
      : 0;

  return (
    <div className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-50">
            Invoice Marketplace
          </h1>
          <p className="text-neutral-400 mt-1">
            Earn yield by funding small business invoices
          </p>
        </div>

        {/* Search and Filters */}
        <div className="glass-card rounded-xl p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by debtor or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-700 rounded-lg bg-surface-2 text-neutral-50 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-4 py-2 border border-neutral-700 rounded-lg bg-surface-2 text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              >
                <option value="yield">Highest Yield</option>
                <option value="amount">Highest Amount</option>
                <option value="due_date">Soonest Due</option>
                <option value="risk">Lowest Risk</option>
              </select>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Input
                label="Min Amount"
                type="number"
                placeholder="1000"
                value={filters.minAmount}
                onChange={(e) =>
                  setFilters({ ...filters, minAmount: e.target.value })
                }
              />
              <Input
                label="Max Amount"
                type="number"
                placeholder="10000"
                value={filters.maxAmount}
                onChange={(e) =>
                  setFilters({ ...filters, maxAmount: e.target.value })
                }
              />
              <Input
                label="Min Discount %"
                type="number"
                placeholder="5"
                value={filters.minDiscount}
                onChange={(e) =>
                  setFilters({ ...filters, minDiscount: e.target.value })
                }
              />
              <Input
                label="Max Days"
                type="number"
                placeholder="90"
                value={filters.maxDays}
                onChange={(e) =>
                  setFilters({ ...filters, maxDays: e.target.value })
                }
              />
            </div>
          )}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-sm text-neutral-400">Active Listings</p>
            <p className="text-2xl font-bold text-neutral-50">
              {filteredListings.length}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-sm text-neutral-400">Total Value</p>
            <p className="text-2xl font-bold text-neutral-50">
              {formatUSDC(totalValue)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-sm text-neutral-400">Avg. Discount</p>
            <p className="text-2xl font-bold text-neutral-50">
              {avgDiscount.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
            <p className="text-neutral-400">Loading listings...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12 glass-card rounded-xl border border-danger-500/20">
            <p className="text-red-400">{error}</p>
            <Button className="mt-4" onClick={fetchActiveListings}>
              Try Again
            </Button>
          </div>
        )}

        {/* Listings Grid */}
        {!isLoading && !error && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((item) => (
              <ListingCard key={item.listing.id} listing={item} />
            ))}
          </div>
        )}

        {!isLoading && !error && filteredListings.length === 0 && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Search className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-400">No listings found</p>
            <p className="text-sm text-neutral-500 mt-1">
              Try adjusting your filters or check back later
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ListingCard({ listing }: { listing: ListingWithInvoice }) {
  const { invoice } = listing;
  const daysUntilDue = getDaysUntil(invoice.due_date);
  const discount = calculateDiscount(
    Number(invoice.amount),
    Number(listing.listing.asking_price)
  );
  const apy = calculateAPY(discount, daysUntilDue);
  const risk = getRiskLevel(invoice.risk_score);

  return (
    <div className="glass-card glass-card-hover rounded-xl overflow-hidden transition-all duration-300">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-neutral-50 text-lg">
              {invoice.debtor_name}
            </h3>
            <p className="text-sm text-neutral-500 truncate max-w-[200px]">
              {invoice.description}
            </p>
          </div>
          <span
            className={`flex items-center text-sm font-medium ${risk.color}`}
          >
            {risk.emoji} {risk.label}
          </span>
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-neutral-500">Invoice Value</p>
            <p className="text-lg font-semibold text-neutral-50">
              {formatUSDC(invoice.amount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-neutral-500">Your Price</p>
            <p className="text-lg font-semibold text-primary-400">
              {formatUSDC(listing.listing.asking_price)}
            </p>
          </div>
        </div>

        {/* Yield Badge */}
        <div className="bg-gradient-to-r from-primary-500/10 to-primary-500/5 border border-primary-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary-400" />
              <span className="font-semibold text-primary-300">
                {discount.toFixed(1)}% DISCOUNT
              </span>
            </div>
            <span className="text-sm text-primary-400">
              ~{apy.toFixed(0)}% APY
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center justify-between text-sm text-neutral-400 mb-4">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>Due in {daysUntilDue} days</span>
          </div>
          <div className="flex items-center space-x-1">
            <Shield className="w-4 h-4" />
            <span>Score: {invoice.risk_score}/100</span>
          </div>
        </div>

        {/* Action */}
        <Link to={`/invoice/${invoice.id}`}>
          <Button className="w-full">
            Buy for {formatUSDC(listing.listing.asking_price)}
          </Button>
        </Link>
      </div>
    </div>
  );
}
