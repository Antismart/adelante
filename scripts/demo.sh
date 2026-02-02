#!/bin/bash

# Adelante Demo Script
# ====================
# Interactive demo walkthrough for hackathon presentations.
# Run this script while the frontend is running (npm run dev).

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║              🚀 ADELANTE DEMO WALKTHROUGH 🚀                  ║"
echo "║                                                              ║"
echo "║     Invoice Factoring Marketplace on NEAR Protocol          ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Configuration
NETWORK="testnet"
INVOICE_CONTRACT="invoice.adelante.testnet"
MARKETPLACE_CONTRACT="marketplace.adelante.testnet"
ESCROW_CONTRACT="escrow.adelante.testnet"

echo "📋 Contract Addresses:"
echo "   Invoice:     $INVOICE_CONTRACT"
echo "   Marketplace: $MARKETPLACE_CONTRACT"
echo "   Escrow:      $ESCROW_CONTRACT"
echo ""

# Check if contracts are deployed
echo "🔍 Checking contract status..."
echo ""

check_contract() {
    local contract=$1
    local result=$(near view-state $contract --finality final 2>/dev/null | head -1)
    if [[ $result == *"Error"* ]] || [[ -z "$result" ]]; then
        echo "   ❌ $contract - Not deployed"
        return 1
    else
        echo "   ✅ $contract - Deployed"
        return 0
    fi
}

check_contract $INVOICE_CONTRACT
check_contract $MARKETPLACE_CONTRACT
check_contract $ESCROW_CONTRACT

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📖 DEMO FLOW:"
echo ""
echo "1️⃣  HOME PAGE (http://localhost:5173)"
echo "    - Show the landing page and value proposition"
echo "    - Highlight NEAR-native features section"
echo "    - Click 'Connect Wallet' or 'Get Started'"
echo ""
echo "2️⃣  CONNECT WALLET"
echo "    - Connect with MyNEARWallet (testnet)"
echo "    - Notice the human-readable account display"
echo "    - Color-coded avatar based on account ID"
echo ""
echo "3️⃣  DASHBOARD (http://localhost:5173/dashboard)"
echo "    - View 'My Invoices' - invoices you've created"
echo "    - View 'My Escrows' - invoices you've purchased"
echo "    - See Cross-Chain Addresses panel"
echo "      → Derived addresses on ETH, Polygon, Arbitrum, Optimism"
echo "      → Click copy or view on explorer"
echo ""
echo "4️⃣  MARKETPLACE (http://localhost:5173/marketplace)"
echo "    - Browse available invoices"
echo "    - Use filters: amount range, due date, yield %"
echo "    - Click an invoice to view details"
echo ""
echo "5️⃣  PURCHASE INVOICE (http://localhost:5173/invoice/1)"
echo "    - Review invoice details and yield calculation"
echo "    - Click 'Buy Now' and approve transaction"
echo "    - After purchase:"
echo "      → Invoice ownership transfers"
echo "      → Funds go to escrow"
echo "      → Seller receives immediate payment"
echo ""
echo "6️⃣  ESCROW FLOW (Back to Dashboard)"
echo "    - See new escrow in 'My Escrows'"
echo "    - When debtor pays: 'Settle' releases funds to investor"
echo "    - Dispute option available if needed"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🎯 KEY TALKING POINTS:"
echo ""
echo "   • \$3.1T locked in unpaid invoices globally"
echo "   • NEAR enables sub-second, sub-cent transactions"
echo "   • Human-readable accounts = better UX"
echo "   • Chain Signatures = single account, multi-chain"
echo "   • Smart contracts handle trust & escrow"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Optional: Query live data
read -p "📊 Would you like to query live contract data? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Fetching marketplace stats..."
    echo ""

    # Get active listings
    echo "📦 Active Listings:"
    near view $MARKETPLACE_CONTRACT get_active_listings '{"from_index": 0, "limit": 10}' --networkId $NETWORK 2>/dev/null || echo "   (No data or contract not deployed)"

    echo ""
    echo "📄 Recent Invoices:"
    near view $INVOICE_CONTRACT get_invoices_by_issuer '{"issuer": "'$INVOICE_CONTRACT'", "from_index": 0, "limit": 5}' --networkId $NETWORK 2>/dev/null || echo "   (No data or contract not deployed)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🌐 Frontend running at: http://localhost:5173"
echo ""
echo "Don't wait. Adelante! 🚀"
echo ""
