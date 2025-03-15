import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { 
  detectThinFloors, 
  sweepFloor, 
  getCollectionAnalytics,
  autoSweep 
} from '../nft/floorDetector';
import {
  formatEth,
  formatPercent,
  calculateRiskScore,
  parseCollectionIds,
  calculateEstimatedProfit
} from '../nft/utils/helpers';

// Load environment variables
dotenv.config();

// Configuration
const RESERVOIR_API_KEY = process.env.RESERVOIR_API_KEY || '';
const RESERVOIR_API_BASE = 'https://api.reservoir.tools';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const RPC_URL = process.env.RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

// Parse collections from environment variable or use defaults
const COLLECTIONS_TO_MONITOR = parseCollectionIds(process.env.COLLECTIONS_TO_MONITOR) || [
  '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // BAYC
  '0x60e4d786628fea6478f785a6d7e704777c86a7c6', // MAYC
  '0xed5af388653567af2f388e6224dc7c4b3241c544'  // Azuki
];

// Parse other configuration options
const MAX_PRICE_PER_ITEM = parseFloat(process.env.MAX_PRICE_PER_ITEM || '2');
const MAX_TOTAL_SPEND = parseFloat(process.env.MAX_TOTAL_SPEND || '5');
const MIN_DISCOUNT_PERCENT = parseFloat(process.env.MIN_DISCOUNT_PERCENT || '10');
const MAX_GAS_PRICE = parseInt(process.env.MAX_GAS_PRICE || '30');

// Create provider and signer
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

async function main() {
  try {
    // Check if required environment variables are set
    if (!RESERVOIR_API_KEY) {
      console.error('Error: RESERVOIR_API_KEY is required');
      process.exit(1);
    }

    if (COLLECTIONS_TO_MONITOR.length === 0) {
      console.error('Error: No collections specified to monitor');
      process.exit(1);
    }

    console.log('NFT Floor Sweeper');
    console.log('----------------');
    console.log(`Monitoring ${COLLECTIONS_TO_MONITOR.length} collections`);
    console.log(`Max price per item: ${MAX_PRICE_PER_ITEM} ETH`);
    console.log(`Max total spend: ${MAX_TOTAL_SPEND} ETH`);
    console.log(`Min discount: ${MIN_DISCOUNT_PERCENT}%`);
    console.log(`Max gas price: ${MAX_GAS_PRICE} gwei`);
    console.log('----------------\n');
    
    // 1. Example: Get detailed analytics for a collection
    console.log('Getting collection analytics...');
    const analytics = await getCollectionAnalytics(
      COLLECTIONS_TO_MONITOR[0],
      RESERVOIR_API_KEY,
      RESERVOIR_API_BASE
    );
    
    if (analytics) {
      console.log('Collection Analytics:');
      console.log(`Name: ${analytics.name}`);
      console.log(`Floor Price: ${formatEth(analytics.floorPrice)} ETH`);
      console.log(`24h Volume: ${formatEth(analytics.volume24h)} ETH`);
      console.log(`24h Volume Change: ${formatPercent(analytics.volumeChange24h)}`);
      console.log(`Market Cap: ${formatEth(analytics.marketCap)} ETH`);
      console.log(`Total Supply: ${analytics.totalSupply}`);
      console.log(`Owner Count: ${analytics.ownerCount}`);
      console.log(`Liquidity Score: ${analytics.liquidityScore.toFixed(2)}/10`);
      console.log(`Price Volatility: ${(analytics.priceVolatility * 100).toFixed(2)}%`);
      console.log(`Whale Concentration: ${(analytics.whaleConcentration * 100).toFixed(2)}%`);
      
      // Calculate risk score
      const riskScore = calculateRiskScore(
        analytics.priceVolatility,
        analytics.whaleConcentration,
        analytics.liquidityScore,
        analytics.volumeChange24h
      );
      
      console.log(`Risk Score: ${riskScore}/100 (lower is safer)`);
    }
    
    // 2. Example: Detect thin floors (NFTs listed below floor price)
    console.log('\nDetecting thin floors...');
    const opportunities = await detectThinFloors(
      COLLECTIONS_TO_MONITOR,
      MIN_DISCOUNT_PERCENT / 100, // Convert percentage to decimal
      RESERVOIR_API_KEY,
      RESERVOIR_API_BASE,
      {
        includeRarity: true,
        maxRequestsPerSecond: 3,
        minDiscount: MIN_DISCOUNT_PERCENT,
        maxResults: 5
      }
    );
    
    console.log(`Found ${opportunities.length} opportunities:`);
    opportunities.forEach((opportunity, index) => {
      console.log(`\nOpportunity #${index + 1}:`);
      console.log(`Collection: ${opportunity.collectionName}`);
      console.log(`Token ID: ${opportunity.tokenId}`);
      console.log(`Price: ${formatEth(opportunity.listingPrice)} ETH (Floor: ${formatEth(opportunity.floorPrice)} ETH)`);
      console.log(`Discount: ${opportunity.discount.toFixed(2)}%`);
      
      // Estimate profit (assuming 0.01 ETH gas cost)
      const estimatedGasCost = 0.01;
      const { profit, roi } = calculateEstimatedProfit(
        opportunity.listingPrice,
        opportunity.floorPrice,
        estimatedGasCost
      );
      
      console.log(`Estimated Profit: ${formatEth(profit)} ETH (ROI: ${formatPercent(roi)})`);
      
      if (opportunity.rarity !== undefined) {
        console.log(`Rarity: ${opportunity.rarity.toFixed(2)}th percentile`);
      }
      
      if (opportunity.source) {
        console.log(`Source: ${opportunity.source}`);
      }
      
      if (opportunity.validUntil) {
        const expirationDate = new Date(opportunity.validUntil * 1000);
        console.log(`Valid until: ${expirationDate.toLocaleString()}`);
      }
    });
    
    // 3. Example: Manual sweep (commented out for safety)
    /*
    if (opportunities.length > 0) {
      console.log('\nSweeping floor for the best opportunity...');
      const bestOpportunity = opportunities[0];
      
      const txHashes = await sweepFloor(
        bestOpportunity.collectionId,
        bestOpportunity.listingPrice,
        wallet,
        RESERVOIR_API_KEY,
        RESERVOIR_API_BASE,
        {
          maxItems: 1,
          gasMultiplier: 1.2,
          maxGasPrice: MAX_GAS_PRICE
        }
      );
      
      console.log(`Sweep completed with ${txHashes.length} purchases`);
      txHashes.forEach(txHash => {
        console.log(`Transaction: ${txHash}`);
      });
    }
    */
    
    // 4. Example: Auto-sweep (commented out for safety)
    /*
    console.log('\nStarting auto-sweep monitor...');
    const stopAutoSweep = await autoSweep(
      COLLECTIONS_TO_MONITOR,
      MIN_DISCOUNT_PERCENT,
      MAX_PRICE_PER_ITEM,
      MAX_TOTAL_SPEND,
      wallet,
      RESERVOIR_API_KEY,
      RESERVOIR_API_BASE,
      {
        checkIntervalMs: 120000, // Check every 2 minutes
        includeRarity: true,
        maxItemsPerSweep: 2,
        minRarityPercentile: 30 // Only top 30% rarity
      }
    );
    
    // Run for 10 minutes then stop
    setTimeout(() => {
      console.log('Stopping auto-sweep monitor...');
      stopAutoSweep();
      process.exit(0);
    }, 10 * 60 * 1000);
    */
    
    // If not running auto-sweep, exit after manual checks
    if (!process.argv.includes('--auto')) {
      console.log('\nExiting...');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 