export const NETWORK_ID: "mainnet" | "testnet" = "testnet";

export const CONTRACT_IDS = {
  invoice: "invoice.onchainchef.testnet",
  marketplace: "marketplace.onchainchef.testnet",
  escrow: "escrow.onchainchef.testnet",
  usdc: "usdc.fakes.testnet",
};

export const nearConfig = {
  networkId: NETWORK_ID,
  nodeUrl: `https://rpc.${NETWORK_ID}.near.org`,
  walletUrl: `https://wallet.${NETWORK_ID}.near.org`,
  helperUrl: `https://helper.${NETWORK_ID}.near.org`,
  explorerUrl: `https://${NETWORK_ID}.nearblocks.io`,
};
