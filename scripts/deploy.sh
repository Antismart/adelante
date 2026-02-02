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
    echo "Error: NEAR CLI not found. Install with: npm install -g near-cli"
    exit 1
fi

# Check if WASM files exist
if [ ! -f "out/invoice.wasm" ]; then
    echo "Error: WASM files not found. Run './scripts/build-contracts.sh' first."
    exit 1
fi

# Deploy Invoice Contract
echo ""
echo "Deploying Invoice Contract to $INVOICE_CONTRACT..."
near deploy --accountId $INVOICE_CONTRACT --wasmFile out/invoice.wasm --networkId $NETWORK

# Initialize Invoice Contract
echo "Initializing Invoice Contract..."
near call $INVOICE_CONTRACT new \
    '{"marketplace_contract": "'$MARKETPLACE_CONTRACT'", "escrow_contract": "'$ESCROW_CONTRACT'"}' \
    --accountId $INVOICE_CONTRACT \
    --networkId $NETWORK

# Deploy Marketplace Contract
echo ""
echo "Deploying Marketplace Contract to $MARKETPLACE_CONTRACT..."
near deploy --accountId $MARKETPLACE_CONTRACT --wasmFile out/marketplace.wasm --networkId $NETWORK

# Initialize Marketplace Contract
echo "Initializing Marketplace Contract..."
near call $MARKETPLACE_CONTRACT new \
    '{"invoice_contract": "'$INVOICE_CONTRACT'", "escrow_contract": "'$ESCROW_CONTRACT'", "usdc_contract": "'$USDC_CONTRACT'", "fee_recipient": "'$MARKETPLACE_CONTRACT'"}' \
    --accountId $MARKETPLACE_CONTRACT \
    --networkId $NETWORK

# Deploy Escrow Contract
echo ""
echo "Deploying Escrow Contract to $ESCROW_CONTRACT..."
near deploy --accountId $ESCROW_CONTRACT --wasmFile out/escrow.wasm --networkId $NETWORK

# Initialize Escrow Contract
echo "Initializing Escrow Contract..."
near call $ESCROW_CONTRACT new \
    '{"invoice_contract": "'$INVOICE_CONTRACT'", "marketplace_contract": "'$MARKETPLACE_CONTRACT'", "usdc_contract": "'$USDC_CONTRACT'", "admin": "'$ESCROW_CONTRACT'"}' \
    --accountId $ESCROW_CONTRACT \
    --networkId $NETWORK

echo ""
echo "================================================="
echo "Deployment complete!"
echo ""
echo "Contract addresses:"
echo "  Invoice:     $INVOICE_CONTRACT"
echo "  Marketplace: $MARKETPLACE_CONTRACT"
echo "  Escrow:      $ESCROW_CONTRACT"
echo "================================================="
