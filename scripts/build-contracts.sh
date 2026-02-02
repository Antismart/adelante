#!/bin/bash
set -e

echo "Building Adelante Smart Contracts..."
echo "======================================"

cd "$(dirname "$0")/../contracts"

# Build all contracts
echo "Building invoice contract..."
cargo build --target wasm32-unknown-unknown --release -p invoice

echo "Building marketplace contract..."
cargo build --target wasm32-unknown-unknown --release -p marketplace

echo "Building escrow contract..."
cargo build --target wasm32-unknown-unknown --release -p escrow

# Copy WASM files to a convenient location
mkdir -p ../out

cp target/wasm32-unknown-unknown/release/invoice.wasm ../out/
cp target/wasm32-unknown-unknown/release/marketplace.wasm ../out/
cp target/wasm32-unknown-unknown/release/escrow.wasm ../out/

echo ""
echo "Build complete! WASM files are in the 'out' directory."
echo "======================================"
ls -la ../out/*.wasm
