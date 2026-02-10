import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";
import {
  getAccountDisplayName,
  getAccountColor,
  getAccountInitials,
  getAccountType,
  isNamedAccount,
  getExplorerAccountUrl,
  truncateAccountId,
} from "../../lib/format";
import { cn } from "../../lib/utils";

interface AccountDisplayProps {
  accountId: string;
  size?: "sm" | "md" | "lg";
  showFullOnHover?: boolean;
  showCopy?: boolean;
  showExplorer?: boolean;
  showType?: boolean;
  className?: string;
}

export function AccountDisplay({
  accountId,
  size = "md",
  showFullOnHover = true,
  showCopy = false,
  showExplorer = false,
  showType = false,
  className,
}: AccountDisplayProps) {
  const [copied, setCopied] = useState(false);

  const displayName = getAccountDisplayName(accountId);
  const color = getAccountColor(accountId);
  const initials = getAccountInitials(accountId);
  const accountType = getAccountType(accountId);
  const isNamed = isNamedAccount(accountId);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(accountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sizeClasses = {
    sm: {
      avatar: "w-6 h-6 text-xs",
      text: "text-sm",
      badge: "text-xs px-1.5 py-0.5",
    },
    md: {
      avatar: "w-8 h-8 text-sm",
      text: "text-sm",
      badge: "text-xs px-2 py-0.5",
    },
    lg: {
      avatar: "w-10 h-10 text-base",
      text: "text-base",
      badge: "text-sm px-2 py-1",
    },
  };

  return (
    <div className={cn("flex items-center space-x-2 group", className)}>
      {/* Avatar */}
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-medium text-white flex-shrink-0",
          sizeClasses[size].avatar
        )}
        style={{ backgroundColor: color }}
      >
        {initials}
      </div>

      {/* Account Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center space-x-2">
          {/* Display Name */}
          <span
            className={cn(
              "font-medium text-neutral-50 truncate",
              sizeClasses[size].text
            )}
            title={showFullOnHover ? accountId : undefined}
          >
            {isNamed ? displayName : truncateAccountId(accountId, 16)}
          </span>

          {/* Named Account Badge */}
          {isNamed && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-500/10 text-primary-400">
              .{accountId.split('.').pop()}
            </span>
          )}

          {/* Copy Button */}
          {showCopy && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              title="Copy account ID"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 text-neutral-400" />
              )}
            </button>
          )}

          {/* Explorer Link */}
          {showExplorer && (
            <a
              href={getExplorerAccountUrl(accountId)}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              title="View on Explorer"
            >
              <ExternalLink className="w-3 h-3 text-neutral-400" />
            </a>
          )}
        </div>

        {/* Account Type */}
        {showType && (
          <p className="text-xs text-neutral-500">{accountType}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Simple inline account display for use in text
 */
interface AccountLinkProps {
  accountId: string;
  className?: string;
}

export function AccountLink({ accountId, className }: AccountLinkProps) {
  const displayName = getAccountDisplayName(accountId);
  const color = getAccountColor(accountId);
  const isNamed = isNamedAccount(accountId);

  return (
    <a
      href={getExplorerAccountUrl(accountId)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center space-x-1 hover:underline",
        className
      )}
      title={accountId}
    >
      <span
        className="inline-block w-4 h-4 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="font-medium">
        {isNamed ? displayName : truncateAccountId(accountId, 12)}
      </span>
      {isNamed && (
        <span className="text-neutral-500">.{accountId.split('.').pop()}</span>
      )}
    </a>
  );
}
