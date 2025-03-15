#!/bin/bash

# Change to the project root directory
cd "$(dirname "$0")/../.."

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "Error: .env file not found. Please create one based on src/nft/.env.example"
  exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Build the project
echo "Building project..."
pnpm build

# Run the NFT floor sweeper
echo "Starting NFT floor sweeper..."

# Parse command line arguments
AUTO_MODE=false
for arg in "$@"; do
  if [ "$arg" == "--auto" ]; then
    AUTO_MODE=true
    echo "Running in auto-sweep mode"
  fi
done

if [ "$AUTO_MODE" == "true" ]; then
  node dist/examples/nftFloorSweeper.js --auto
else
  node dist/examples/nftFloorSweeper.js
fi 