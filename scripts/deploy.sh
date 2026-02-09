#!/bin/bash
set -e

echo "Deploying Adelante Contracts to NEAR Testnet..."
echo "================================================="

# Configuration
NETWORK="testnet"
MASTER_ACCOUNT="onchainchef.testnet"

# Contract account IDs
INVOICE_CONTRACT="invoice.$MASTER_ACCOUNT"
MARKETPLACE_CONTRACT="marketplace.$MASTER_ACCOUNT"
ESCROW_CONTRACT="escrow.$MASTER_ACCOUNT"
USDC_CONTRACT="usdc.fakes.testnet"

# Check if NEAR CLI is installed
if ! command -v near &> /dev/null; then
    echo "Error: NEAR CLI not found. Install with: cargo install near-cli-rs"
    exit 1
fi

# Check if WASM files exist
if [ ! -f "out/invoice.wasm" ]; then
    echo "Error: WASM files not found. Run './scripts/build-contracts.sh' first."
    exit 1
fi

# Deploy + Initialize Invoice Contract
echo ""
echo "Deploying Invoice Contract to $INVOICE_CONTRACT..."
near deploy $INVOICE_CONTRACT out/invoice.wasm \
    --init-function new \
    --init-args '{"marketplace_contract": "'$MARKETPLACE_CONTRACT'", "escrow_contract": "'$ESCROW_CONTRACT'", "admin": "'$MASTER_ACCOUNT'"}' \
    --network-id $NETWORK

# Deploy + Initialize Marketplace Contract
echo ""
echo "Deploying Marketplace Contract to $MARKETPLACE_CONTRACT..."
near deploy $MARKETPLACE_CONTRACT out/marketplace.wasm \
    --init-function new \
    --init-args '{"invoice_contract": "'$INVOICE_CONTRACT'", "escrow_contract": "'$ESCROW_CONTRACT'", "usdc_contract": "'$USDC_CONTRACT'", "fee_recipient": "'$MARKETPLACE_CONTRACT'"}' \
    --network-id $NETWORK

# Deploy + Initialize Escrow Contract
echo ""
echo "Deploying Escrow Contract to $ESCROW_CONTRACT..."
near deploy $ESCROW_CONTRACT out/escrow.wasm \
    --init-function new \
    --init-args '{"invoice_contract": "'$INVOICE_CONTRACT'", "marketplace_contract": "'$MARKETPLACE_CONTRACT'", "usdc_contract": "'$USDC_CONTRACT'", "admin": "'$ESCROW_CONTRACT'"}' \
    --network-id $NETWORK

echo ""
echo "================================================="
echo "Deployment complete!"
echo ""
echo "Contract addresses:"
echo "  Invoice:     $INVOICE_CONTRACT"
echo "  Marketplace: $MARKETPLACE_CONTRACT"
echo "  Escrow:      $ESCROW_CONTRACT"
echo "================================================="
