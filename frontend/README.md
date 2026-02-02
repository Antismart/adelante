# Adelante Frontend

React frontend for the Adelante invoice factoring marketplace on NEAR Protocol.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Architecture

### State Management

Uses Zustand for global state:

- **walletStore** - Wallet connection, account ID, selector instance
- **invoiceStore** - Invoices and escrows cache

### Hooks

Custom hooks for contract interactions:

| Hook | Purpose |
|------|---------|
| `useInvoices` | Create and fetch invoices from the invoice contract |
| `useMarketplace` | List, browse, and purchase invoices |
| `useEscrow` | Manage escrows, settlements, and disputes |
| `useChainSignatures` | Derive cross-chain addresses via MPC |

### Components

```
src/components/
├── common/           # Reusable UI components
│   ├── Button.tsx    # Primary action button
│   ├── Card.tsx      # Content container
│   └── Input.tsx     # Form input with label
├── invoice/          # Invoice-specific
│   ├── InvoiceCard.tsx      # Compact invoice display
│   └── InvoiceDetails.tsx   # Full invoice view
├── near/             # NEAR-specific features
│   ├── AccountDisplay.tsx     # Human-readable account rendering
│   └── CrossChainAddresses.tsx # Chain Signatures addresses
└── wallet/           # Wallet connection
    └── WalletButton.tsx  # Connect/disconnect with dropdown
```

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with feature highlights |
| Dashboard | `/dashboard` | User's invoices and escrows |
| Marketplace | `/marketplace` | Browse and filter listings |
| Invoice | `/invoice/:id` | Invoice details and purchase |
| Create | `/create` | Create new invoice |

## Configuration

Contract addresses are configured in `src/config/near.ts`:

```typescript
export const CONTRACT_IDS = {
  invoice: "invoice.adelante.testnet",
  marketplace: "marketplace.adelante.testnet",
  escrow: "escrow.adelante.testnet",
  usdc: "usdc.fakes.testnet",
};
```

## NEAR-Native Features

### Human-Readable Accounts

The `AccountDisplay` component renders NEAR accounts with:
- Color-coded avatars based on account ID hash
- Badge indicating named vs implicit account
- Copy-to-clipboard functionality
- Direct link to NearBlocks explorer

### Chain Signatures

The `CrossChainAddresses` component shows:
- Derived addresses on Ethereum, Polygon, Arbitrum, Optimism
- Copy and explorer links for each chain
- Explanation of MPC-based cross-chain control

Note: Current implementation uses demo addresses. Production would call the MPC contract's `derived_public_key` method.

## Development

### Type Safety

Uses TypeScript with strict mode. Contract response types are defined in `src/types/index.ts`.

### Styling

TailwindCSS 4 with custom design tokens:
- `primary-*` - Brand colors (green)
- `neutral-*` - Grayscale

### Contract Interactions

All contract calls go through NEAR Wallet Selector:

```typescript
const wallet = await selector.wallet();
await wallet.signAndSendTransaction({
  receiverId: CONTRACT_ID,
  actions: [
    {
      type: "FunctionCall",
      params: {
        methodName: "method_name",
        args: { /* ... */ },
        gas: "30000000000000",
        deposit: "1",
      },
    },
  ],
});
```

View methods use direct RPC calls for better performance.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |
