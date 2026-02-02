# Adelante

> "Don't wait. Adelante."

**Invoice Factoring Marketplace on NEAR Protocol**

Adelante is a decentralized invoice factoring marketplace where small businesses can sell their unpaid invoices to investors at a discount, receiving immediate cash flow instead of waiting 30-90 days for payment.

## The Problem

Small businesses have **$3.1 TRILLION** locked in unpaid invoices globally. A business ships goods worth $5,000 but payment comes in 60 days. They need cash NOW to pay suppliers, employees, and grow. Traditional banks won't help — too small, too risky, too much paperwork.

## The Solution

A permissionless marketplace where:
1. **Businesses** tokenize invoices as NFTs and list them for sale
2. **Investors** browse and purchase invoices at a discount
3. **Smart contracts** handle escrow and settlement

Everyone wins: Business gets immediate liquidity, investor earns yield.

## NEAR-Native Features

Adelante leverages NEAR Protocol's unique capabilities:

### Human-Readable Accounts
- Named accounts like `grace-textiles.near` instead of cryptographic hashes
- Visual badges distinguish named accounts from implicit accounts
- Color-coded avatars based on account identity
- One-click explorer links for transaction history

### Chain Signatures (Cross-Chain)
- NEAR accounts can derive addresses on Ethereum, Polygon, Arbitrum, and Optimism
- Receive payments on any supported chain
- Single NEAR account controls multi-chain assets
- MPC (Multi-Party Computation) network for secure key generation

### Fast Finality
- ~1 second transaction confirmations
- Real-time marketplace updates
- Instant escrow settlements

### Low Fees
- Sub-cent transaction costs
- Makes micro-invoice factoring viable

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.75+
- [NEAR CLI](https://docs.near.org/tools/near-cli)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/adelante.git
cd adelante

# Install frontend dependencies
cd frontend
npm install

# Start development server
npm run dev
```

### Build Smart Contracts

```bash
# Install Rust target for WASM
rustup target add wasm32-unknown-unknown

# Build contracts
./scripts/build-contracts.sh
```

### Deploy to Testnet

```bash
# Make sure you have NEAR CLI configured
near login

# Create sub-accounts for contracts (one-time setup)
near create-account invoice.adelante.testnet --masterAccount adelante.testnet
near create-account marketplace.adelante.testnet --masterAccount adelante.testnet
near create-account escrow.adelante.testnet --masterAccount adelante.testnet

# Deploy contracts
./scripts/deploy.sh

# Seed demo data
./scripts/seed-data.sh
```

## Project Structure

```
adelante/
├── contracts/              # NEAR Smart Contracts (Rust)
│   ├── invoice/            # Invoice NFT Contract
│   │   └── src/lib.rs      # Invoice creation, transfer, status
│   ├── marketplace/        # Marketplace Contract
│   │   └── src/lib.rs      # Listings, purchases, fees
│   └── escrow/             # Escrow Contract
│       └── src/lib.rs      # Funds custody, settlements, disputes
├── frontend/               # React Frontend
│   └── src/
│       ├── components/     # UI Components
│       │   ├── common/     # Buttons, Cards, Inputs
│       │   ├── invoice/    # Invoice-specific components
│       │   ├── near/       # NEAR-specific (AccountDisplay, CrossChainAddresses)
│       │   └── wallet/     # Wallet connection
│       ├── hooks/          # React hooks
│       │   ├── useInvoices.ts
│       │   ├── useMarketplace.ts
│       │   ├── useEscrow.ts
│       │   └── useChainSignatures.ts
│       ├── pages/          # Page Components
│       ├── stores/         # Zustand State
│       └── lib/            # Utilities
│           ├── chainSignatures.ts  # Cross-chain support
│           └── format.ts           # Account formatting
├── scripts/                # Build & Deploy Scripts
│   ├── build-contracts.sh
│   ├── deploy.sh
│   └── seed-data.sh
└── docs/                   # Documentation
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Rust + near-sdk 5.6 |
| Frontend | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | TailwindCSS 4 |
| Wallet | NEAR Wallet Selector |
| State | Zustand |
| Storage | IPFS (Pinata) |

## How It Works

### For Businesses

1. **Create Invoice** - Upload your invoice details and PDF
2. **List for Sale** - Set your asking price (discount from face value)
3. **Get Paid** - Receive instant payment when an investor buys

### For Investors

1. **Browse Marketplace** - Find invoices with attractive yields
2. **Purchase Invoice** - Pay the discounted price
3. **Earn Yield** - Receive full invoice amount when debtor pays

### Escrow Flow

```
Business creates invoice → Lists on marketplace → Investor purchases
                                                        ↓
                                              Funds held in escrow
                                                        ↓
                            Debtor pays invoice → Escrow settles
                                                        ↓
                                              Investor receives funds
```

## Smart Contract Methods

### Invoice Contract

| Method | Description |
|--------|-------------|
| `create_invoice` | Create a new invoice NFT |
| `get_invoice` | View invoice details |
| `get_invoices_by_issuer` | List all invoices by creator |
| `update_status` | Update invoice payment status |
| `transfer_invoice` | Transfer ownership |

### Marketplace Contract

| Method | Description |
|--------|-------------|
| `list_invoice` | List an invoice for sale |
| `cancel_listing` | Remove a listing |
| `buy_invoice` | Purchase a listed invoice |
| `get_listing` | View listing details |
| `get_active_listings` | Browse all active listings |

### Escrow Contract

| Method | Description |
|--------|-------------|
| `get_escrow` | View escrow details |
| `settle` | Release funds to investor |
| `open_dispute` | Flag an escrow for dispute |
| `simulate_debtor_payment` | (Demo) Simulate debtor paying |

## Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| Invoice | `invoice.adelante.testnet` |
| Marketplace | `marketplace.adelante.testnet` |
| Escrow | `escrow.adelante.testnet` |
| Mock USDC | `usdc.fakes.testnet` |

## Demo Walkthrough

1. **Connect Wallet** - Use MyNEARWallet or any supported wallet
2. **View Dashboard** - See your invoices and escrows
3. **Browse Marketplace** - Filter by amount, due date, yield
4. **Purchase Invoice** - Click "Buy Now" and approve transaction
5. **Check Escrow** - View purchased invoices in escrow
6. **Cross-Chain** - See your derived addresses on other chains

## Environment Variables

Create `.env` in the frontend directory:

```env
VITE_NETWORK_ID=testnet
VITE_INVOICE_CONTRACT=invoice.adelante.testnet
VITE_MARKETPLACE_CONTRACT=marketplace.adelante.testnet
VITE_ESCROW_CONTRACT=escrow.adelante.testnet
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

---

Built for the NEAR Protocol Hackathon — "Open Society: From Finance to the Real World" Track

## Links

- [NEAR Protocol](https://near.org)
- [NEAR Wallet Selector](https://github.com/near/wallet-selector)
- [Chain Signatures Docs](https://docs.near.org/chain-signatures)
# adelante
