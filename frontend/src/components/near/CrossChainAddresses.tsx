import { useState, useEffect, useRef } from "react";
import { Globe, Copy, Check, ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { useChainSignatures } from "../../hooks/useChainSignatures";
import { Button } from "../common/Button";
import { cn } from "../../lib/utils";
import type { SupportedChain } from "../../lib/chainSignatures";

// Chain icons as simple colored circles with abbreviations
const CHAIN_STYLES: Record<SupportedChain, { bg: string; abbr: string }> = {
  ethereum: { bg: "bg-blue-500", abbr: "ETH" },
  polygon: { bg: "bg-purple-500", abbr: "POL" },
  arbitrum: { bg: "bg-sky-500", abbr: "ARB" },
  optimism: { bg: "bg-red-500", abbr: "OP" },
  bitcoin: { bg: "bg-orange-500", abbr: "BTC" },
};

interface CrossChainAddressesProps {
  className?: string;
  compact?: boolean;
}

export function CrossChainAddresses({ className, compact = false }: CrossChainAddressesProps) {
  const {
    isEnabled,
    isLoading,
    error,
    derivedAddresses,
    getAllDerivedAddresses,
    getChainConfig,
    supportedChains,
  } = useChainSignatures();

  const [copiedChain, setCopiedChain] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  // Load addresses on first render
  useEffect(() => {
    if (isEnabled && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      getAllDerivedAddresses();
    }
  }, [isEnabled, getAllDerivedAddresses]);

  const handleCopy = async (address: string, chain: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedChain(chain);
    setTimeout(() => setCopiedChain(null), 2000);
  };

  if (!isEnabled) {
    return (
      <div className={cn("bg-neutral-50 rounded-lg p-4", className)}>
        <div className="flex items-center space-x-2 text-neutral-500">
          <Globe className="w-5 h-5" />
          <span className="text-sm">Chain Signatures not available on this network</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <Globe className="w-4 h-4 text-neutral-500" />
        <span className="text-sm text-neutral-600">
          {derivedAddresses.length} cross-chain addresses
        </span>
      </div>
    );
  }

  // Filter to EVM chains for now
  const evmChains = supportedChains.filter((c) => c !== "bitcoin");

  return (
    <div className={cn("bg-white rounded-xl border border-neutral-200", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-neutral-900">Cross-Chain Addresses</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={getAllDerivedAddresses}
          disabled={isLoading}
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
        <p className="text-sm text-primary-700">
          Your NEAR account can control addresses on other blockchains using Chain Signatures.
          Receive payments on Ethereum, Polygon, and more!
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Addresses List */}
      <div className="divide-y divide-neutral-100">
        {evmChains.map((chain) => {
          const config = getChainConfig(chain);
          const derived = derivedAddresses.find((a) => a.chain === chain);
          const style = CHAIN_STYLES[chain];

          return (
            <div key={chain} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Chain Icon */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                    style.bg
                  )}
                >
                  {style.abbr}
                </div>

                {/* Chain Info */}
                <div>
                  <p className="font-medium text-neutral-900">{config.name}</p>
                  {derived ? (
                    <code className="text-xs text-neutral-500 font-mono">
                      {derived.address.slice(0, 10)}...{derived.address.slice(-8)}
                    </code>
                  ) : (
                    <span className="text-xs text-neutral-400">
                      {isLoading ? "Loading..." : "Not derived yet"}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {derived && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleCopy(derived.address, chain)}
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copiedChain === chain ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>
                  <a
                    href={`${config.addressExplorerUrl}/${derived.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-4 h-4 text-neutral-400" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100">
        <div className="flex items-start space-x-2 text-xs text-neutral-500">
          <Wallet className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            These addresses are controlled by your NEAR account through the Chain Signatures
            MPC network. Transactions are signed on NEAR and broadcast to the target chain.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple badge showing cross-chain capability
 */
export function CrossChainBadge() {
  const { isEnabled } = useChainSignatures();

  if (!isEnabled) return null;

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r from-blue-100 to-purple-100 text-purple-700">
      <Globe className="w-3 h-3 mr-1" />
      Cross-Chain
    </span>
  );
}
