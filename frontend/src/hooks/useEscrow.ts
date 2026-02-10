import { useState, useCallback } from "react";
import { actionCreators } from "@near-js/transactions";
import { useWalletStore } from "../stores/walletStore";
import { useInvoiceStore } from "../stores/invoiceStore";
import { CONTRACT_IDS } from "../config/near";
import type { EscrowEntry, EscrowStats } from "../types";

const THIRTY_TGAS = BigInt("30000000000000");

export function useEscrow() {
  const { selector, accountId } = useWalletStore();
  const { escrows, setEscrows } = useInvoiceStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEscrowsByBuyer = useCallback(async () => {
    if (!accountId) return;

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
            account_id: CONTRACT_IDS.escrow,
            method_name: "get_escrows_by_buyer",
            args_base64: btoa(JSON.stringify({ buyer: accountId })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const escrowList: EscrowEntry[] = JSON.parse(resultString);
        setEscrows(escrowList);
      }
    } catch (err) {
      console.error("Failed to fetch escrows:", err);
      setError("Failed to fetch escrows");
    } finally {
      setIsLoading(false);
    }
  }, [accountId, setEscrows]);

  const fetchEscrowsBySeller = useCallback(async () => {
    if (!accountId) return;

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
            account_id: CONTRACT_IDS.escrow,
            method_name: "get_escrows_by_seller",
            args_base64: btoa(JSON.stringify({ seller: accountId })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const escrowList: EscrowEntry[] = JSON.parse(resultString);
        setEscrows(escrowList);
      }
    } catch (err) {
      console.error("Failed to fetch escrows:", err);
      setError("Failed to fetch escrows");
    } finally {
      setIsLoading(false);
    }
  }, [accountId, setEscrows]);

  const fetchEscrowStats = useCallback(async (): Promise<EscrowStats | null> => {
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
            account_id: CONTRACT_IDS.escrow,
            method_name: "get_stats",
            args_base64: btoa(JSON.stringify({})),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        return JSON.parse(resultString);
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch escrow stats:", err);
      return null;
    }
  }, []);

  const getEscrowByInvoice = useCallback(async (invoiceId: string): Promise<EscrowEntry | null> => {
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
            account_id: CONTRACT_IDS.escrow,
            method_name: "get_escrow_by_invoice",
            args_base64: btoa(JSON.stringify({ invoice_id: invoiceId })),
          },
        }),
      });

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        return JSON.parse(resultString);
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch escrow:", err);
      return null;
    }
  }, []);

  const settleEscrow = useCallback(
    async (escrowId: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.escrow,
          actions: [
            actionCreators.functionCall(
              "settle",
              { escrow_id: escrowId },
              THIRTY_TGAS,
              BigInt(0),
            ),
          ],
        });

        // Refresh escrows
        await fetchEscrowsByBuyer();
        return true;
      } catch (err) {
        console.error("Failed to settle escrow:", err);
        setError("Failed to settle escrow");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchEscrowsByBuyer]
  );

  const openDispute = useCallback(
    async (escrowId: string, reason: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.escrow,
          actions: [
            actionCreators.functionCall(
              "open_dispute",
              { escrow_id: escrowId, reason },
              THIRTY_TGAS,
              BigInt(0),
            ),
          ],
        });

        // Refresh escrows
        await fetchEscrowsByBuyer();
        return true;
      } catch (err) {
        console.error("Failed to open dispute:", err);
        setError("Failed to open dispute");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchEscrowsByBuyer]
  );

  const simulateDebtorPayment = useCallback(
    async (escrowId: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      setIsLoading(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.escrow,
          actions: [
            actionCreators.functionCall(
              "simulate_debtor_payment",
              { escrow_id: escrowId },
              THIRTY_TGAS,
              BigInt(0),
            ),
          ],
        });

        // Refresh escrows
        await fetchEscrowsByBuyer();
        return true;
      } catch (err) {
        console.error("Failed to simulate payment:", err);
        setError("Failed to simulate payment");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [selector, accountId, fetchEscrowsByBuyer]
  );

  return {
    escrows,
    isLoading,
    error,
    fetchEscrowsByBuyer,
    fetchEscrowsBySeller,
    fetchEscrowStats,
    getEscrowByInvoice,
    settleEscrow,
    openDispute,
    simulateDebtorPayment,
  };
}
