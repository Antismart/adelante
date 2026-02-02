#!/bin/bash
set -e

echo "Seeding Demo Data for Adelante..."
echo "=================================="

# Configuration
NETWORK="testnet"
INVOICE_CONTRACT="invoice.onchainchef.testnet"
MARKETPLACE_CONTRACT="marketplace.onchainchef.testnet"
ESCROW_CONTRACT="escrow.onchainchef.testnet"
USDC_CONTRACT="usdc.fakes.testnet"

# Using the main account for demo data
CREATOR="onchainchef.testnet"

echo ""
echo "Step 1: Registering contracts with USDC storage..."
echo "---------------------------------------------------"

# Register marketplace contract with USDC token storage
echo "Registering marketplace contract with USDC..."
near contract call-function as-transaction $USDC_CONTRACT storage_deposit json-args "{\"account_id\": \"$MARKETPLACE_CONTRACT\"}" prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Marketplace already registered or error"

# Register escrow contract with USDC token storage
echo "Registering escrow contract with USDC..."
near contract call-function as-transaction $USDC_CONTRACT storage_deposit json-args "{\"account_id\": \"$ESCROW_CONTRACT\"}" prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Escrow already registered or error"

# Register creator account with USDC if not already
echo "Ensuring creator account has USDC storage..."
near contract call-function as-transaction $USDC_CONTRACT storage_deposit json-args "{\"account_id\": \"$CREATOR\"}" prepaid-gas '30 Tgas' attached-deposit '0.00125 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Creator already registered"

echo ""
echo "Step 2: Creating demo invoices..."
echo "---------------------------------------------------"

# Calculate due dates (30, 45, 60 days from now in nanoseconds)
NOW_MS=$(date +%s)000
DUE_30_DAYS=$((NOW_MS + 30 * 24 * 60 * 60 * 1000))
DUE_45_DAYS=$((NOW_MS + 45 * 24 * 60 * 60 * 1000))
DUE_60_DAYS=$((NOW_MS + 60 * 24 * 60 * 60 * 1000))

# USDC amounts (6 decimals)
# $2,000 = 2000000000 (2000 * 10^6)
# $5,000 = 5000000000
# $3,200 = 3200000000

# Invoice 1: Grace Textiles - $2,000
echo "Creating Invoice 1: Grace Textiles ($2,000)..."
near contract call-function as-transaction $INVOICE_CONTRACT create_invoice json-args "{
  \"amount\": \"2000000000\",
  \"debtor_name\": \"Amsterdam Trading Co.\",
  \"debtor_email\": \"accounts@amsterdam-trading.com\",
  \"description\": \"200 meters of premium cotton fabric shipped via DHL Express\",
  \"due_date\": $DUE_30_DAYS,
  \"documents_hash\": \"QmXYZ123abc456def789gracetextiles\"
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

# Invoice 2: Coffee Exports - $5,000
echo "Creating Invoice 2: Coffee Exports ($5,000)..."
near contract call-function as-transaction $INVOICE_CONTRACT create_invoice json-args "{
  \"amount\": \"5000000000\",
  \"debtor_name\": \"Acme Corporation\",
  \"debtor_email\": \"payments@acme.com\",
  \"description\": \"500 units of organic coffee beans - Premium Arabica grade\",
  \"due_date\": $DUE_45_DAYS,
  \"documents_hash\": \"QmABC456def789ghi012coffeeexports\"
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

# Invoice 3: Tech Services - $3,200
echo "Creating Invoice 3: Tech Services ($3,200)..."
near contract call-function as-transaction $INVOICE_CONTRACT create_invoice json-args "{
  \"amount\": \"3200000000\",
  \"debtor_name\": \"TechStart Inc.\",
  \"debtor_email\": \"finance@techstart.io\",
  \"description\": \"Cloud infrastructure consulting services - Q4 2024\",
  \"due_date\": $DUE_60_DAYS,
  \"documents_hash\": \"QmDEF789ghi012jkl345techservices\"
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

echo ""
echo "Step 3: Setting invoices to Listed status..."
echo "---------------------------------------------------"

# Set invoices to Listed status so they can be listed on marketplace
echo "Setting Invoice 1 to Listed..."
near contract call-function as-transaction $INVOICE_CONTRACT set_listed json-args '{"invoice_id": "INV-000001"}' prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Invoice 1 status update skipped"

echo "Setting Invoice 2 to Listed..."
near contract call-function as-transaction $INVOICE_CONTRACT set_listed json-args '{"invoice_id": "INV-000002"}' prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Invoice 2 status update skipped"

echo "Setting Invoice 3 to Listed..."
near contract call-function as-transaction $INVOICE_CONTRACT set_listed json-args '{"invoice_id": "INV-000003"}' prepaid-gas '30 Tgas' attached-deposit '1 yoctoNEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send || echo "Invoice 3 status update skipped"

echo ""
echo "Step 4: Listing invoices on marketplace..."
echo "---------------------------------------------------"

# List Invoice 1 at 7.5% discount: $2,000 -> $1,850
# Asking price: 1850000000 (6 decimals)
echo "Listing Invoice 1: $2,000 for $1,850 (7.5% discount)..."
near contract call-function as-transaction $MARKETPLACE_CONTRACT list_invoice json-args "{
  \"invoice_id\": \"INV-000001\",
  \"asking_price\": \"1850000000\",
  \"invoice_amount\": \"2000000000\",
  \"due_date\": $DUE_30_DAYS,
  \"min_price\": null,
  \"expires_at\": null
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

# List Invoice 2 at 7% discount: $5,000 -> $4,650
echo "Listing Invoice 2: $5,000 for $4,650 (7.0% discount)..."
near contract call-function as-transaction $MARKETPLACE_CONTRACT list_invoice json-args "{
  \"invoice_id\": \"INV-000002\",
  \"asking_price\": \"4650000000\",
  \"invoice_amount\": \"5000000000\",
  \"due_date\": $DUE_45_DAYS,
  \"min_price\": null,
  \"expires_at\": null
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

# List Invoice 3 at 6.25% discount: $3,200 -> $3,000
echo "Listing Invoice 3: $3,200 for $3,000 (6.25% discount)..."
near contract call-function as-transaction $MARKETPLACE_CONTRACT list_invoice json-args "{
  \"invoice_id\": \"INV-000003\",
  \"asking_price\": \"3000000000\",
  \"invoice_amount\": \"3200000000\",
  \"due_date\": $DUE_60_DAYS,
  \"min_price\": null,
  \"expires_at\": null
}" prepaid-gas '30 Tgas' attached-deposit '0.01 NEAR' sign-as $CREATOR network-config $NETWORK sign-with-keychain send

echo ""
echo "=================================="
echo "Demo data seeded successfully!"
echo "=================================="
echo ""
echo "Created invoices:"
echo "  1. INV-000001: Grace Textiles - \$2,000 (Amsterdam Trading Co.)"
echo "     Listed for: \$1,850 (7.5% discount, ~91% APY over 30 days)"
echo ""
echo "  2. INV-000002: Coffee Exports - \$5,000 (Acme Corporation)"
echo "     Listed for: \$4,650 (7.0% discount, ~57% APY over 45 days)"
echo ""
echo "  3. INV-000003: Tech Services - \$3,200 (TechStart Inc.)"
echo "     Listed for: \$3,000 (6.25% discount, ~38% APY over 60 days)"
echo ""
echo "View marketplace at: https://adelante.example.com/marketplace"
echo "=================================="
