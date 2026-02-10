import { formatDistanceToNow, format, differenceInDays } from "date-fns";

/**
 * Format USDC amount (6 decimals) to display string
 */
export function formatUSDC(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  // USDC has 6 decimals
  const value = num / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse USD amount to USDC (6 decimals)
 */
export function parseUSDC(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.floor(num * 1_000_000).toString();
}

/**
 * Format a date to a readable string
 */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), "MMM d, yyyy");
}

/**
 * Get days until a date
 */
export function getDaysUntil(timestamp: number): number {
  return differenceInDays(new Date(timestamp), new Date());
}

/**
 * Format relative time
 */
export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

/**
 * Calculate discount percentage
 */
export function calculateDiscount(
  invoiceAmount: string | number,
  askingPrice: string | number
): number {
  const invoice =
    typeof invoiceAmount === "string" ? parseFloat(invoiceAmount) : invoiceAmount;
  const price =
    typeof askingPrice === "string" ? parseFloat(askingPrice) : askingPrice;

  if (invoice === 0) return 0;
  return ((invoice - price) / invoice) * 100;
}

/**
 * Calculate annualized yield (APY)
 */
export function calculateAPY(
  discountPercentage: number,
  daysUntilDue: number
): number {
  if (daysUntilDue <= 0) return 0;
  // Simple annualization: (discount / days) * 365
  return (discountPercentage / daysUntilDue) * 365;
}

/**
 * Truncate NEAR account ID for display
 */
export function truncateAccountId(accountId: string, maxLength: number = 16): string {
  if (accountId.length <= maxLength) return accountId;
  return `${accountId.slice(0, 8)}...${accountId.slice(-6)}`;
}

/**
 * Check if account ID is a named account (human-readable)
 * Named accounts end with .near or .testnet
 */
export function isNamedAccount(accountId: string): boolean {
  return accountId.endsWith('.near') || accountId.endsWith('.testnet');
}

/**
 * Check if account ID is an implicit account (64-character hex)
 */
export function isImplicitAccount(accountId: string): boolean {
  return /^[0-9a-f]{64}$/.test(accountId);
}

/**
 * Get the display name from a NEAR account ID
 * For named accounts like "grace-textiles.testnet", returns "grace-textiles"
 * For implicit accounts, returns truncated version
 */
export function getAccountDisplayName(accountId: string): string {
  if (!accountId) return '';

  // For named accounts, get the part before .near/.testnet
  if (isNamedAccount(accountId)) {
    const parts = accountId.split('.');
    // Handle subaccounts like "alice.grace-textiles.testnet"
    if (parts.length >= 3) {
      return parts.slice(0, -1).join('.');
    }
    return parts[0];
  }

  // For implicit accounts, truncate
  if (isImplicitAccount(accountId)) {
    return truncateAccountId(accountId, 12);
  }

  return accountId;
}

/**
 * Get account type label
 */
export function getAccountType(accountId: string): string {
  if (isNamedAccount(accountId)) {
    if (accountId.split('.').length > 2) {
      return 'Subaccount';
    }
    return 'Named Account';
  }
  if (isImplicitAccount(accountId)) {
    return 'Implicit Account';
  }
  return 'Account';
}

/**
 * Generate a deterministic color based on account ID
 */
export function getAccountColor(accountId: string): string {
  if (!accountId) return '#6366f1'; // default indigo

  // Generate a hash from the account ID
  let hash = 0;
  for (let i = 0; i < accountId.length; i++) {
    const char = accountId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Use predefined color palette for better aesthetics
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#d946ef', // fuchsia
    '#ec4899', // pink
    '#f43f5e', // rose
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#eab308', // yellow
    '#84cc16', // lime
    '#22c55e', // green
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#0ea5e9', // sky
    '#3b82f6', // blue
  ];

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Generate initials from account ID
 */
export function getAccountInitials(accountId: string): string {
  if (!accountId) return '?';

  const displayName = getAccountDisplayName(accountId);

  // For named accounts with dashes/underscores, use first letter of each word
  if (displayName.includes('-') || displayName.includes('_')) {
    const parts = displayName.split(/[-_]/);
    return parts
      .slice(0, 2)
      .map(p => p.charAt(0).toUpperCase())
      .join('');
  }

  // Otherwise use first two characters
  return displayName.slice(0, 2).toUpperCase();
}

/**
 * Format account ID for explorer link
 */
export function getExplorerAccountUrl(accountId: string, network: 'mainnet' | 'testnet' = 'testnet'): string {
  const baseUrl = network === 'mainnet'
    ? 'https://nearblocks.io/address'
    : 'https://testnet.nearblocks.io/address';
  return `${baseUrl}/${accountId}`;
}

/**
 * Validate NEAR account ID format
 */
export function isValidAccountId(accountId: string): boolean {
  // Account ID rules:
  // - 2-64 characters
  // - lowercase letters, digits, -, _
  // - cannot start or end with - or _
  // - cannot have consecutive - or _
  if (!accountId || accountId.length < 2 || accountId.length > 64) {
    return false;
  }

  const regex = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
  return regex.test(accountId);
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (score <= 33) {
    return { label: "Low", color: "text-emerald-400", emoji: "🟢" };
  } else if (score <= 66) {
    return { label: "Medium", color: "text-amber-400", emoji: "🟡" };
  } else {
    return { label: "High", color: "text-red-400", emoji: "🔴" };
  }
}

/**
 * Get status badge styling
 */
export function getStatusStyle(status: string): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "Draft":
      return { bg: "bg-neutral-500/10", text: "text-neutral-300" };
    case "Listed":
      return { bg: "bg-blue-500/10", text: "text-blue-400" };
    case "Sold":
      return { bg: "bg-purple-500/10", text: "text-purple-400" };
    case "Settled":
      return { bg: "bg-emerald-500/10", text: "text-emerald-400" };
    case "Disputed":
      return { bg: "bg-red-500/10", text: "text-red-400" };
    case "Cancelled":
      return { bg: "bg-neutral-500/10", text: "text-neutral-500" };
    default:
      return { bg: "bg-neutral-500/10", text: "text-neutral-300" };
  }
}
