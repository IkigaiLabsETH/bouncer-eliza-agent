# NFT Floor Price Detection and Sweeping

This module provides advanced functionality for detecting NFTs listed below floor price and automatically purchasing them when good opportunities arise. It's designed to help traders identify and capitalize on market inefficiencies in NFT collections.

## Features

- **Detailed Collection Analytics**: Get comprehensive data about NFT collections including floor price, volume, market cap, liquidity score, price volatility, and whale concentration.
- **Thin Floor Detection**: Find NFTs listed significantly below floor price with customizable discount thresholds.
- **Rarity Analysis**: Include rarity data in opportunity detection to find rare NFTs at discount prices.
- **Gas Optimization**: Automatically optimize gas prices and limits for efficient transactions.
- **Batch Purchasing**: Support for buying multiple NFTs in a single operation.
- **Auto-Sweeping**: Continuously monitor collections and automatically purchase NFTs when they meet specified criteria.
- **Risk Assessment**: Skip collections with suspicious activity patterns like high volatility or whale concentration.
- **Rate Limiting**: Built-in rate limiting to avoid API throttling when monitoring multiple collections.

## Installation

Make sure you have the required dependencies:

```bash
pnpm add axios ethers@5 @reservoir0x/reservoir-sdk dotenv
```

## Environment Variables

Create a `.env` file with the following variables:

```
RESERVOIR_API_KEY=your_reservoir_api_key
PRIVATE_KEY=your_ethereum_private_key
RPC_URL=your_ethereum_rpc_url
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Usage Examples

### Get Collection Analytics

```typescript
import { getCollectionAnalytics } from './nft/floorDetector';

const analytics = await getCollectionAnalytics(
  '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // BAYC collection ID
  'your-reservoir-api-key',
  'https://api.reservoir.tools'
);

console.log(`Floor Price: ${analytics.floorPrice} ETH`);
console.log(`24h Volume: ${analytics.volume24h} ETH`);
console.log(`Liquidity Score: ${analytics.liquidityScore}`);
```

### Detect Thin Floors

```typescript
import { detectThinFloors } from './nft/floorDetector';

const opportunities = await detectThinFloors(
  ['0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'], // Collection IDs to monitor
  0.1, // 10% below floor price threshold
  'your-reservoir-api-key',
  'https://api.reservoir.tools',
  {
    includeRarity: true,
    maxRequestsPerSecond: 3,
    minDiscount: 8, // At least 8% discount
    maxResults: 5
  }
);

console.log(`Found ${opportunities.length} opportunities`);
```

### Sweep Floor (Buy NFTs)

```typescript
import { ethers } from 'ethers';
import { sweepFloor } from './nft/floorDetector';

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider('your-rpc-url');
const wallet = new ethers.Wallet('your-private-key', provider);

const txHashes = await sweepFloor(
  '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // Collection ID
  10, // Maximum price in ETH
  wallet, // Ethers.js signer
  'your-reservoir-api-key',
  'https://api.reservoir.tools',
  {
    maxItems: 3, // Buy up to 3 NFTs
    gasMultiplier: 1.2, // Add 20% to estimated gas
    maxGasPrice: 30 // Max 30 gwei
  }
);

console.log(`Successfully purchased ${txHashes.length} NFTs`);
```

### Auto-Sweep (Continuous Monitoring)

```typescript
import { ethers } from 'ethers';
import { autoSweep } from './nft/floorDetector';

// Set up provider and signer
const provider = new ethers.providers.JsonRpcProvider('your-rpc-url');
const wallet = new ethers.Wallet('your-private-key', provider);

const stopAutoSweep = await autoSweep(
  ['0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'], // Collections to monitor
  10, // 10% discount threshold
  2, // Max 2 ETH per item
  5, // Max 5 ETH total spend
  wallet,
  'your-reservoir-api-key',
  'https://api.reservoir.tools',
  {
    checkIntervalMs: 120000, // Check every 2 minutes
    includeRarity: true,
    maxItemsPerSweep: 2,
    minRarityPercentile: 30 // Only top 30% rarity
  }
);

// Stop monitoring after 1 hour
setTimeout(() => {
  stopAutoSweep();
}, 60 * 60 * 1000);
```

## API Reference

### `getCollectionAnalytics(collectionId, apiKey, apiBase)`

Gets detailed analytics for an NFT collection.

### `getTokenRarity(collectionId, tokenId, apiKey, apiBase)`

Gets rarity data for a specific token in a collection.

### `detectThinFloors(collectionIds, priceThreshold, apiKey, apiBase, options)`

Detects NFTs listed significantly below floor price.

Options:
- `includeRarity`: Whether to include rarity data (default: false)
- `maxRequestsPerSecond`: Rate limit for API requests (default: 5)
- `minDiscount`: Minimum discount percentage (default: 5%)
- `maxResults`: Maximum number of results to return (default: 10)

### `sweepFloor(collectionId, maxPrice, signer, apiKey, apiBase, options)`

Buys NFTs listed below the specified maximum price.

Options:
- `maxItems`: Maximum number of NFTs to buy (default: 1)
- `gasMultiplier`: Multiplier for gas limit (default: 1.1)
- `maxGasPrice`: Maximum gas price in gwei (default: 50)
- `priorityFee`: Priority fee in gwei (default: 1.5)

### `autoSweep(collectionIds, discountThreshold, maxPricePerItem, maxTotalSpend, signer, apiKey, apiBase, options)`

Continuously monitors collections and automatically purchases NFTs when they meet criteria.

Options:
- `checkIntervalMs`: Interval between checks in milliseconds (default: 60000)
- `includeRarity`: Whether to include rarity data (default: true)
- `maxItemsPerSweep`: Maximum number of NFTs to buy per sweep (default: 3)
- `minRarityPercentile`: Minimum rarity percentile to consider (default: 50)

## Important Notes

- **Security**: Keep your private key secure and never commit it to version control.
- **Testing**: Always test with small amounts before deploying with significant funds.
- **Risk Management**: Set appropriate limits for maximum price per item and total spend.
- **API Keys**: Obtain a Reservoir API key from [Reservoir](https://reservoir.tools/).
- **Gas Prices**: Monitor gas prices and adjust settings accordingly during high network congestion.

## Disclaimer

This tool is provided for educational purposes only. Trading NFTs involves significant risk, and you should never invest more than you can afford to lose. Always do your own research before making investment decisions. 