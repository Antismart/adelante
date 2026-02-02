import { useState, useCallback } from "react";
import { useWalletStore } from "../stores/walletStore";
import { useInvoiceStore } from "../stores/invoiceStore";
import { CONTRACT_IDS } from "../config/near";
import type { Invoice, CreateInvoiceParams } from "../types";

const THIRTY_TGAS = "30000000000000";
const DEPOSIT = "10000000000000000000000"; // 0.01 NEAR

export function useInvoices() {
  const { selector, accountId } = useWalletStore();
  const { invoices, setInvoices, setLoading, setError, updateInvoice } =
    useInvoiceStore();
  const [isCreating, setIsCreating] = useState(false);

  const fetchInvoicesByOwner = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://rpc.testnet.near.org`,
        {
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
              method_name: "get_invoices_by_owner",
              args_base64: btoa(JSON.stringify({ account_id: accountId })),
            },
          }),
        }
      );

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const invoiceList: Invoice[] = JSON.parse(resultString);
        setInvoices(invoiceList);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  }, [accountId, setInvoices, setLoading, setError]);

  const fetchInvoicesByCreator = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://rpc.testnet.near.org`,
        {
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
              method_name: "get_invoices_by_creator",
              args_base64: btoa(JSON.stringify({ account_id: accountId })),
            },
          }),
        }
      );

      const data = await response.json();
      if (data.result?.result) {
        const resultString = String.fromCharCode(...data.result.result);
        const invoiceList: Invoice[] = JSON.parse(resultString);
        setInvoices(invoiceList);
      }
    } catch (error) {
      console.error("Failed to fetch invoices:", error);
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  }, [accountId, setInvoices, setLoading, setError]);

  const createInvoice = useCallback(
    async (params: CreateInvoiceParams): Promise<string | null> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return null;
      }

      setIsCreating(true);
      setError(null);

      try {
        const wallet = await selector.wallet();

        const result = await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.invoice,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "create_invoice",
                args: {
                  amount: params.amount,
                  debtor_name: params.debtor_name,
                  debtor_email: params.debtor_email || null,
                  description: params.description,
                  due_date: params.due_date,
                  documents_hash: params.documents_hash,
                },
                gas: THIRTY_TGAS,
                deposit: DEPOSIT,
              },
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });

        // Refresh invoices after creation
        await fetchInvoicesByCreator();

        return result?.transaction?.hash || null;
      } catch (error) {
        console.error("Failed to create invoice:", error);
        setError("Failed to create invoice");
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [selector, accountId, setError, fetchInvoicesByCreator]
  );

  const setInvoiceListed = useCallback(
    async (invoiceId: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.invoice,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "set_listed",
                args: { invoice_id: invoiceId },
                gas: THIRTY_TGAS,
                deposit: "1",
              },
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });

        updateInvoice(invoiceId, { status: "Listed" });
        return true;
      } catch (error) {
        console.error("Failed to list invoice:", error);
        setError("Failed to list invoice");
        return false;
      }
    },
    [selector, accountId, setError, updateInvoice]
  );

  const cancelInvoice = useCallback(
    async (invoiceId: string): Promise<boolean> => {
      if (!selector || !accountId) {
        setError("Wallet not connected");
        return false;
      }

      try {
        const wallet = await selector.wallet();

        await wallet.signAndSendTransaction({
          receiverId: CONTRACT_IDS.invoice,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "cancel_invoice",
                args: { invoice_id: invoiceId },
                gas: THIRTY_TGAS,
                deposit: "1",
              },
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ] as any,
        });

        updateInvoice(invoiceId, { status: "Cancelled" });
        return true;
      } catch (error) {
        console.error("Failed to cancel invoice:", error);
        setError("Failed to cancel invoice");
        return false;
      }
    },
    [selector, accountId, setError, updateInvoice]
  );

  return {
    invoices,
    isCreating,
    fetchInvoicesByOwner,
    fetchInvoicesByCreator,
    createInvoice,
    setInvoiceListed,
    cancelInvoice,
  };
}
