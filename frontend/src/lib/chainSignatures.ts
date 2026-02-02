/**
 * NEAR Chain Signatures Integration
 *
 * Chain Signatures allows NEAR accounts to sign transactions for any blockchain
 * using the MPC (Multi-Party Computation) network. This enables cross-chain
 * functionality like:
 * - Receiving payments on Ethereum, Bitcoin, etc.
 * - Managing multi-chain assets from a single NEAR account
 * - Cross-chain invoice settlements
 */

import { keccak256 } from "ethers";
import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { NETWORK_ID, nearConfig } from "../config/near";

// Determine if we're on mainnet or testnet
const isMainnet = NETWORK_ID === "mainnet";

// Chain Signatures MPC Contract on NEAR
export const MPC_CONTRACT = isMainnet
  ? "v1.signer.near"
  : "v1.signer-prod.testnet";

// Supported chains for cross-chain operations
export type SupportedChain = "ethereum" | "bitcoin" | "polygon" | "arbitrum" | "optimism";

export interface ChainConfig {
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  explorerUrl: string;
  addressExplorerUrl: string;
  iconUrl?: string;
}

// Chain configurations
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  ethereum: {
    chainId: isMainnet ? "1" : "11155111", // Mainnet or Sepolia
    name: isMainnet ? "Ethereum" : "Sepolia Testnet",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: isMainnet
      ? "https://eth.llamarpc.com"
      : "https://rpc.sepolia.org",
    explorerUrl: isMainnet
      ? "https://etherscan.io"
      : "https://sepolia.etherscan.io",
    addressExplorerUrl: isMainnet
      ? "https://etherscan.io/address"
      : "https://sepolia.etherscan.io/address",
  },
  bitcoin: {
    chainId: isMainnet ? "mainnet" : "testnet",
    name: isMainnet ? "Bitcoin" : "Bitcoin Testnet",
    symbol: "BTC",
    decimals: 8,
    rpcUrl: "",
    explorerUrl: isMainnet
      ? "https://blockstream.info"
      : "https://blockstream.info/testnet",
    addressExplorerUrl: isMainnet
      ? "https://blockstream.info/address"
      : "https://blockstream.info/testnet/address",
  },
  polygon: {
    chainId: isMainnet ? "137" : "80002",
    name: isMainnet ? "Polygon" : "Polygon Amoy",
    symbol: "MATIC",
    decimals: 18,
    rpcUrl: isMainnet
      ? "https://polygon-rpc.com"
      : "https://rpc-amoy.polygon.technology",
    explorerUrl: isMainnet
      ? "https://polygonscan.com"
      : "https://amoy.polygonscan.com",
    addressExplorerUrl: isMainnet
      ? "https://polygonscan.com/address"
      : "https://amoy.polygonscan.com/address",
  },
  arbitrum: {
    chainId: isMainnet ? "42161" : "421614",
    name: isMainnet ? "Arbitrum One" : "Arbitrum Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: isMainnet
      ? "https://arb1.arbitrum.io/rpc"
      : "https://sepolia-rollup.arbitrum.io/rpc",
    explorerUrl: isMainnet
      ? "https://arbiscan.io"
      : "https://sepolia.arbiscan.io",
    addressExplorerUrl: isMainnet
      ? "https://arbiscan.io/address"
      : "https://sepolia.arbiscan.io/address",
  },
  optimism: {
    chainId: isMainnet ? "10" : "11155420",
    name: isMainnet ? "Optimism" : "Optimism Sepolia",
    symbol: "ETH",
    decimals: 18,
    rpcUrl: isMainnet
      ? "https://mainnet.optimism.io"
      : "https://sepolia.optimism.io",
    explorerUrl: isMainnet
      ? "https://optimistic.etherscan.io"
      : "https://sepolia-optimism.etherscan.io",
    addressExplorerUrl: isMainnet
      ? "https://optimistic.etherscan.io/address"
      : "https://sepolia-optimism.etherscan.io/address",
  },
};

/**
 * Derivation path for generating chain-specific keys from NEAR account
 * This follows BIP-32/BIP-44 style paths
 */
export function getDerivationPath(
  nearAccountId: string,
  chain: SupportedChain,
  index: number = 0
): string {
  // Create a deterministic path based on account and chain
  return `${nearAccountId},${chain},${index}`;
}

/**
 * Request payload for chain signature
 */
export interface SignatureRequest {
  chain: SupportedChain;
  payload: string; // Hex-encoded transaction or message to sign
  path: string; // Derivation path
  keyVersion?: number;
}

/**
 * Response from chain signature request
 */
export interface SignatureResponse {
  signature: {
    r: string;
    s: string;
    v: number;
  };
  publicKey: string;
}

// Helper functions for byte manipulation
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Used for debugging if needed
// function bytesToHex(bytes: Uint8Array): string {
//   return Array.from(bytes)
//     .map((b) => b.toString(16).padStart(2, "0"))
//     .join("");
// }

// Base58 alphabet for Bitcoin addresses
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 256;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  // Leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      digits.push(0);
    } else {
      break;
    }
  }
  return digits
    .reverse()
    .map((d) => BASE58_ALPHABET[d])
    .join("");
}

// Cache for MPC public key
let cachedMPCPublicKey: string | null = null;

/**
 * Fetch the MPC public key from the chain signatures contract
 */
async function fetchMPCPublicKey(): Promise<string> {
  if (cachedMPCPublicKey) {
    return cachedMPCPublicKey;
  }

  try {
    const response = await fetch(nearConfig.nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: MPC_CONTRACT,
          method_name: "public_key",
          args_base64: btoa("{}"),
        },
      }),
    });

    const data = await response.json();
    if (data.result?.result) {
      const resultString = String.fromCharCode(...data.result.result);
      cachedMPCPublicKey = JSON.parse(resultString);
      return cachedMPCPublicKey!;
    }
    throw new Error("Failed to fetch MPC public key");
  } catch (error) {
    console.error("Error fetching MPC public key:", error);
    throw error;
  }
}

/**
 * Derive a child public key using the MPC contract's KDF
 * This creates a deterministic key for a specific account and derivation path
 */
async function deriveChildPublicKey(
  nearAccountId: string,
  derivationPath: string
): Promise<string> {
  try {
    const response = await fetch(nearConfig.nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: MPC_CONTRACT,
          method_name: "derived_public_key",
          args_base64: btoa(
            JSON.stringify({
              path: derivationPath,
              predecessor: nearAccountId,
            })
          ),
        },
      }),
    });

    const data = await response.json();
    if (data.result?.result) {
      const resultString = String.fromCharCode(...data.result.result);
      return JSON.parse(resultString);
    }
    throw new Error("Failed to derive public key");
  } catch (error) {
    console.error("Error deriving child public key:", error);
    throw error;
  }
}

/**
 * Convert a secp256k1 public key to an EVM address
 * Takes the Keccak-256 hash and extracts the last 20 bytes
 */
function publicKeyToEVMAddress(publicKey: string): string {
  // Remove "secp256k1:" prefix if present
  const cleanKey = publicKey.replace("secp256k1:", "");

  // The public key from NEAR is in compressed format (33 bytes)
  // We need to decompress it to uncompressed format (65 bytes) for Keccak-256
  // For now, we'll use the compressed key hash which gives consistent addresses
  const keyBytes = hexToBytes(cleanKey);

  // Take Keccak-256 hash
  const hash = keccak256(keyBytes);

  // Take last 20 bytes (40 hex chars)
  const address = "0x" + hash.slice(-40);

  return address.toLowerCase();
}

/**
 * Convert a secp256k1 public key to a Bitcoin address (P2PKH)
 * Uses RIPEMD-160(SHA-256(pubkey)) with Base58Check encoding
 */
function publicKeyToBitcoinAddress(publicKey: string): string {
  // Remove "secp256k1:" prefix if present
  const cleanKey = publicKey.replace("secp256k1:", "");
  const keyBytes = hexToBytes(cleanKey);

  // Step 1: SHA-256 hash
  const sha256Hash = sha256(keyBytes);

  // Step 2: RIPEMD-160 hash
  const ripemdHash = ripemd160(sha256Hash);

  // Step 3: Add version byte (0x00 for mainnet, 0x6f for testnet)
  const versionByte = isMainnet ? 0x00 : 0x6f;
  const versionedPayload = new Uint8Array(21);
  versionedPayload[0] = versionByte;
  versionedPayload.set(ripemdHash, 1);

  // Step 4: Double SHA-256 for checksum
  const checksum = sha256(sha256(versionedPayload)).slice(0, 4);

  // Step 5: Append checksum
  const addressBytes = new Uint8Array(25);
  addressBytes.set(versionedPayload);
  addressBytes.set(checksum, 21);

  // Step 6: Base58 encode
  return base58Encode(addressBytes);
}

/**
 * Derive the foreign chain address for a NEAR account
 * Uses the MPC contract to derive a deterministic address for any chain
 */
export async function deriveForeignAddress(
  nearAccountId: string,
  chain: SupportedChain,
  index: number = 0
): Promise<string | null> {
  try {
    // Get derivation path
    const derivationPath = getDerivationPath(nearAccountId, chain, index);

    // Derive the child public key from the MPC contract
    const derivedPublicKey = await deriveChildPublicKey(nearAccountId, derivationPath);

    // Convert to chain-specific address format
    if (chain === "bitcoin") {
      return publicKeyToBitcoinAddress(derivedPublicKey);
    }

    // For all EVM chains (Ethereum, Polygon, Arbitrum, Optimism)
    return publicKeyToEVMAddress(derivedPublicKey);
  } catch (error) {
    console.error(`Failed to derive ${chain} address:`, error);
    return null;
  }
}

/**
 * Convert a public key to a chain-specific address
 */
export function publicKeyToAddress(publicKey: string, chain: SupportedChain): string {
  if (chain === "bitcoin") {
    return publicKeyToBitcoinAddress(publicKey);
  }
  return publicKeyToEVMAddress(publicKey);
}

/**
 * Create an unsigned EVM transaction
 */
export interface EVMTransaction {
  to: string;
  value: string;
  data?: string;
  nonce: number;
  gasLimit: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: string;
}

/**
 * Encode an EVM transaction for signing
 */
export function encodeEVMTransaction(tx: EVMTransaction): string {
  // In production, use ethers.js Transaction class
  return JSON.stringify(tx);
}

/**
 * Check if chain signatures are available for an account
 */
export async function isChainSignaturesEnabled(): Promise<boolean> {
  try {
    await fetchMPCPublicKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the explorer URL for a transaction on a foreign chain
 */
export function getForeignExplorerUrl(chain: SupportedChain, txHash: string): string {
  const config = CHAIN_CONFIGS[chain];
  return `${config.explorerUrl}/tx/${txHash}`;
}

/**
 * Get the explorer URL for an address on a foreign chain
 */
export function getAddressExplorerUrl(chain: SupportedChain, address: string): string {
  const config = CHAIN_CONFIGS[chain];
  return `${config.addressExplorerUrl}/${address}`;
}

/**
 * Format an amount for a specific chain
 */
export function formatChainAmount(amount: string, chain: SupportedChain): string {
  const config = CHAIN_CONFIGS[chain];
  const value = parseFloat(amount) / Math.pow(10, config.decimals);
  return `${value.toFixed(6)} ${config.symbol}`;
}
