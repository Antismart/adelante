import { useState, useCallback } from "react";
import { actionCreators } from "@near-js/transactions";
import { useWalletStore } from "../stores/walletStore";
import { CONTRACT_IDS } from "../config/near";

// USDC has 6 decimals
const USDC_DECIMALS = 6;
const THIRTY_TGAS = BigInt("30000000000000");
const ONE_HUNDRED_TGAS = BigInt("100000000000000");
const ONE_YOCTO = BigInt("1");
const STORAGE_DEPOSIT = BigInt("1250000000000000000000"); // 0.00125 NEAR

export function useUSDCToken() {
  const { selector, accountId } = useWalletStore();
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format USDC amount from raw (6 decimals) to human readable
  const formatUSDC = useCallback((amount: string): string => {
    const num = BigInt(amount);
    const divisor = BigInt(10 ** USDC_DECIMALS);
    const whole = num / divisor;
    const fraction = num % divisor;
    const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0");
    return `${whole}.${fractionStr.slice(0, 2)}`;
  }, []);

  // Parse human readable amount to raw USDC (6 decimals)
  const parseUSDC = useCallback((amount: string): string => {
    const [whole, fraction = ""] = amount.split(".");
    const paddedFraction = fraction.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
    return `${whole}${paddedFraction}`.replace(/^0+/, "") || "0";
  }, []);

  // Fetch USDC balance for current account
  const fetchBalance = useCallback(async () => {
    if (!accountId) {
      setBalance("0");
      return "0";
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://rpc.testnet.near.org`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: CONTRACT_IDS.usdc,
            method_name: "ft_balance_of",
            args_base64: btoa(JSON.stringify({ account_id: accountId })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const rawBalance = JSON.parse(resultString);
        setBalance(rawBalance);
        return rawBalance;
      }
      return "0";
    } catch (err) {
      console.error("Failed to fetch USDC balance:", err);
      setError("Failed to fetch USDC balance");
      return "0";
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  // Check if account has storage registered with USDC contract
  const checkStorageRegistered = useCallback(async (account: string): Promise<boolean> => {
    try {
      const response = await fetch(`https://rpc.testnet.near.org`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: CONTRACT_IDS.usdc,
            method_name: "storage_balance_of",
            args_base64: btoa(JSON.stringify({ account_id: account })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const storageBalance = JSON.parse(resultString);
        return storageBalance !== null;
      }
      return false;
    } catch (err) {
      console.error("Failed to check storage registration:", err);
      return false;
    }
  }, []);

  // Register storage for an account
  const registerStorage = useCallback(async (account: string): Promise<boolean> => {
    if (!selector || !accountId) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const wallet = await selector.wallet();

      await wallet.signAndSendTransaction({
        receiverId: CONTRACT_IDS.usdc,
        actions: [
          actionCreators.functionCall(
            "storage_deposit",
            { account_id: account },
            THIRTY_TGAS,
            STORAGE_DEPOSIT,
          ),
        ],
      });

      return true;
    } catch (err) {
      console.error("Failed to register storage:", err);
      setError("Failed to register storage");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selector, accountId]);

  // Transfer USDC with a message (ft_transfer_call)
  // This is used for buying invoices - sends USDC to marketplace with purchase message
  const transferCall = useCallback(
    async (
      receiverId: string,
      amount: string,
      msg: string
    ): Promise<string | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const result = await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.usdc,
          actions: [
            actionCreators.functionCall(
              "ft_transfer_call",
              {
                receiver_id: receiverId,
                amount: amount,
                memo: null,
                msg: msg,
              },
              ONE_HUNDRED_TGAS,
              ONE_YOCTO,
            ),
          ],
        });

        // Refresh balance after transfer
        await fetchBalance();

        return result?.transaction?.hash || null;
      } catch (err) {
        console.error("Failed to transfer USDC:", err);
        setError("Failed to transfer USDC");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchBalance]
  );

  // Simple transfer without callback message
  const transfer = useCallback(
    async (receiverId: string, amount: string): Promise<string | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const result = await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.usdc,
          actions: [
            actionCreators.functionCall(
              "ft_transfer",
              {
                receiver_id: receiverId,
                amount: amount,
                memo: null,
              },
              THIRTY_TGAS,
              ONE_YOCTO,
            ),
          ],
        });

        await fetchBalance();
        return result?.transaction?.hash || null;
      } catch (err) {
        console.error("Failed to transfer USDC:", err);
        setError("Failed to transfer USDC");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchBalance]
  );

  return {
    balance,
    isLoading,
    error,
    fetchBalance,
    formatUSDC,
    parseUSDC,
    checkStorageRegistered,
    registerStorage,
    transferCall,
    transfer,
    USDC_DECIMALS,
  };
}
