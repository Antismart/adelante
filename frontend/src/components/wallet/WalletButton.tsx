import { Wallet, LogOut, ChevronDown, ExternalLink, Copy, Check, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWalletStore } from "../../stores/walletStore";
import { Button } from "../common/Button";
import {
  getAccountDisplayName,
  getAccountColor,
  getAccountInitials,
  getAccountType,
  isNamedAccount,
  getExplorerAccountUrl,
} from "../../lib/format";

export function WalletButton() {
  const { accountId, isConnected, isLoading, connect, disconnect } =
    useWalletStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <span className="animate-pulse">Loading...</span>
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button onClick={connect}>
        <Wallet className="w-4 h-4 mr-2" />
        Connect Wallet
      </Button>
    );
  }

  const displayName = getAccountDisplayName(accountId || "");
  const color = getAccountColor(accountId || "");
  const initials = getAccountInitials(accountId || "");
  const accountType = getAccountType(accountId || "");
  const isNamed = isNamedAccount(accountId || "");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-surface-3 hover:bg-surface-4 border border-white/5 rounded-lg transition-colors"
      >
        {/* Account Avatar */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>

        {/* Account Name */}
        <div className="hidden sm:block text-left">
          <span className="text-sm font-medium text-neutral-50">
            {displayName}
          </span>
          {isNamed && (
            <span className="text-xs text-neutral-500">
              .{accountId?.split('.').pop()}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-neutral-500 transition-transform ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-surface-3 rounded-xl shadow-2xl border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] py-2 z-50">
          {/* Account Header */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-50 truncate">
                  {displayName}
                  {isNamed && (
                    <span className="text-neutral-500">
                      .{accountId?.split('.').pop()}
                    </span>
                  )}
                </p>
                <p className="text-xs text-neutral-500">{accountType}</p>
              </div>
            </div>

            {/* Full Account ID with Copy */}
            <div className="mt-3 flex items-center space-x-2 bg-surface-2 border border-white/5 rounded-lg px-3 py-2">
              <code className="flex-1 text-xs text-neutral-400 truncate font-mono">
                {accountId}
              </code>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Copy account ID"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-neutral-400" />
                )}
              </button>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <Link
              to="/dashboard"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center space-x-3 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
            >
              <User className="w-4 h-4 text-neutral-400" />
              <span>My Dashboard</span>
            </Link>

            <a
              href={getExplorerAccountUrl(accountId || "")}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
            >
              <ExternalLink className="w-4 h-4 text-neutral-400" />
              <span>View on Explorer</span>
            </a>
          </div>

          {/* Disconnect */}
          <div className="border-t border-white/5 pt-1 mt-1">
            <button
              onClick={() => {
                disconnect();
                setDropdownOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
