import { useState, useCallback, useEffect } from "react";
import { useWalletStore } from "../stores/walletStore";
import {
  CHAIN_CONFIGS,
  MPC_CONTRACT,
  deriveForeignAddress,
  getDerivationPath,
  isChainSignaturesEnabled,
} from "../lib/chainSignatures";
import type { SupportedChain } from "../lib/chainSignatures";

const SIXTY_TGAS = "60000000000000";
const SIGNATURE_DEPOSIT = "1"; // 1 yoctoNEAR

interface DerivedAddress {
  chain: SupportedChain;
  address: string;
  path: string;
}

export function useChainSignatures() {
  const { selector, accountId } = useWalletStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [derivedAddresses, setDerivedAddresses] = useState<DerivedAddress[]>([]);
  const [isEnabled, setIsEnabled] = useState(false);

  // Check if chain signatures are available
  useEffect(() => {
    isChainSignaturesEnabled().then(setIsEnabled);
  }, []);

  /**
   * Get the derived address for a specific chain
   */
  const getDerivedAddress = useCallback(
    async (chain: SupportedChain, index: number = 0): Promise<string | null> => {
      if (!accountId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const address = await deriveForeignAddress(accountId, chain, index);

        if (address) {
          const path = getDerivationPath(accountId, chain, index);
          setDerivedAddresses((prev) => {
            // Update or add the address
            const existing = prev.findIndex((a) => a.chain === chain);
            if (existing >= 0) {
              const updated = [...prev];
              updated[existing] = { chain, address, path };
              return updated;
            }
            return [...prev, { chain, address, path }];
          });
        }

        return address;
      } catch (err) {
        console.error("Failed to derive address:", err);
        setError("Failed to derive foreign chain address");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [accountId]
  );

  /**
   * Get all derived addresses for supported EVM chains
   */
  const getAllDerivedAddresses = useCallback(async () => {
    if (!accountId) return;

    setIsLoading(true);
    setError(null);

    const evmChains: SupportedChain[] = ["ethereum", "polygon", "arbitrum", "optimism"];
    const addresses: DerivedAddress[] = [];

    for (const chain of evmChains) {
      const address = await deriveForeignAddress(accountId, chain, 0);
      if (address) {
        addresses.push({
          chain,
          address,
          path: getDerivationPath(accountId, chain, 0),
        });
      }
    }

    setDerivedAddresses(addresses);
    setIsLoading(false);
  }, [accountId]);

  /**
   * Request a signature for a foreign chain transaction
   * This calls the MPC contract to sign the payload
   */
  const requestSignature = useCallback(
    async (
      chain: SupportedChain,
      payload: string, // Hex-encoded payload to sign
      index: number = 0
    ): Promise<{ signature: string; publicKey: string } | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();
        const path = getDerivationPath(accountId, chain, index);

        const result = await wallet.signAndSendTransaction({
          receiverId: MPC_CONTRACT,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "sign",
                args: {
                  request: {
                    payload: Array.from(Buffer.from(payload.replace("0x", ""), "hex")),
                    path,
                    key_version: 0,
                  },
                },
                gas: SIXTY_TGAS,
                deposit: SIGNATURE_DEPOSIT,
              },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });

        // In production, parse the signature from the transaction result
        // The signature would be returned in the transaction outcome
        console.log("Signature request result:", result);

        return {
          signature: "pending", // Would extract from result
          publicKey: "", // Would extract from result
        };
      } catch (err) {
        console.error("Failed to request signature:", err);
        setError("Failed to request chain signature");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId]
  );

  /**
   * Get chain configuration
   */
  const getChainConfig = useCallback((chain: SupportedChain) => {
    return CHAIN_CONFIGS[chain];
  }, []);

  /**
   * Check if a specific chain is supported
   */
  const isChainSupported = useCallback((chain: string): chain is SupportedChain => {
    return chain in CHAIN_CONFIGS;
  }, []);

  return {
    isEnabled,
    isLoading,
    error,
    derivedAddresses,
    getDerivedAddress,
    getAllDerivedAddresses,
    requestSignature,
    getChainConfig,
    isChainSupported,
    supportedChains: Object.keys(CHAIN_CONFIGS) as SupportedChain[],
  };
}
