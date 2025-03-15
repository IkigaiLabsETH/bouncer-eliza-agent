import { createClient } from '@reservoir0x/reservoir-sdk';
import { type Signer, BigNumber, ethers } from 'ethers';
import axios from 'axios';

// Export types instead of interfaces to avoid conflicts
export type NFTCollection = {
  id: string;
  name: string;
  floorPrice: number;
  volume24h?: number;
  volumeChange24h?: number;
  marketCap?: number;
  totalSupply?: number;
  ownerCount?: number;
  floorPriceHistory?: {
    timestamp: number;
    price: number;
  }[];
};

export type NFTListing = {
  id: string;
  tokenId: string;
  price: number;
  maker: string;
  validFrom?: number;
  validUntil?: number;
  source?: string;
};

export type CollectionAnalytics = {
  id: string;
  name: string;
  floorPrice: number;
  volume24h: number;
  volumeChange24h: number;
  salesCount24h: number;
  averagePrice24h: number;
  marketCap: number;
  totalSupply: number;
  ownerCount: number;
  uniqueBuyers24h: number;
  uniqueSellers24h: number;
  liquidityScore: number;
  priceVolatility: number;
  whaleConcentration: number;
  floorPriceHistory: {
    timestamp: number;
    price: number;
  }[];
};

interface NotificationPayload {
  collectionName: string;
  collectionId: string;
  floorPrice: number;
  listingPrice: number;
  tokenId: string;
  seller: string;
  discount: number; // Percentage below floor
  source?: string;
  validUntil?: number;
  txHash?: string;
  rarity?: number; // Percentile rarity (lower is rarer)
  estimatedGas?: string;
}

// Rate limiting utility
class RateLimiter {
  private lastRequestTime: number = 0;
  private requestsInWindow: number = 0;
  private readonly maxRequestsPerWindow: number;
  private readonly windowMs: number;

  constructor(maxRequestsPerWindow: number = 5, windowMs: number = 1000) {
    this.maxRequestsPerWindow = maxRequestsPerWindow;
    this.windowMs = windowMs;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastRequestTime > this.windowMs) {
      this.requestsInWindow = 0;
      this.lastRequestTime = now;
      return;
    }
    
    // If we've hit the limit, wait until the window resets
    if (this.requestsInWindow >= this.maxRequestsPerWindow) {
      const timeToWait = this.windowMs - (now - this.lastRequestTime);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      this.requestsInWindow = 0;
      this.lastRequestTime = Date.now();
      return;
    }
    
    this.requestsInWindow++;
    this.lastRequestTime = now;
  }
}

function notify(payload: NotificationPayload) {
  console.log('[Notification]:', `${payload.collectionName} - Token #${payload.tokenId} listed at ${payload.listingPrice} ETH (Floor: ${payload.floorPrice} ETH, Discount: ${payload.discount.toFixed(2)}%)`);
  if (payload.rarity !== undefined) {
    console.log(`Rarity: ${payload.rarity}th percentile`);
  }
  if (payload.source) {
    console.log(`Source: ${payload.source}`);
  }
  if (payload.validUntil) {
    const expirationDate = new Date(payload.validUntil * 1000);
    console.log(`Valid until: ${expirationDate.toLocaleString()}`);
  }
  if (payload.estimatedGas) {
    console.log(`Estimated gas: ${payload.estimatedGas}`);
  }
  if (payload.txHash) {
    console.log('Transaction Hash:', payload.txHash);
  }
}

/**
 * Get detailed analytics for an NFT collection
 */
export async function getCollectionAnalytics(
  collectionId: string,
  apiKey: string,
  apiBase: string
): Promise<CollectionAnalytics | null> {
  try {
    // Get collection details
    const collectionResponse = await axios.get(`${apiBase}/collections/v5`, {
      params: { id: collectionId },
      headers: { 'x-api-key': apiKey }
    });

    const collection = collectionResponse.data.collections?.[0];
    if (!collection) {
      console.log(`No collection found with ID ${collectionId}`);
      return null;
    }

    // Get collection stats
    const statsResponse = await axios.get(`${apiBase}/stats/v2`, {
      params: { collection: collectionId },
      headers: { 'x-api-key': apiKey }
    });

    const stats = statsResponse.data;

    // Get sales history for volatility calculation
    const salesResponse = await axios.get(`${apiBase}/sales/v4`, {
      params: { 
        collection: collectionId,
        limit: 100,
        sortBy: 'timestamp',
        sortDirection: 'desc'
      },
      headers: { 'x-api-key': apiKey }
    });

    const sales = salesResponse.data.sales || [];
    
    // Calculate price volatility from sales data
    let priceVolatility = 0;
    if (sales.length > 1) {
      const prices = sales.map(sale => sale.price?.amount?.native || 0);
      const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
      const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
      priceVolatility = Math.sqrt(variance) / mean; // Coefficient of variation
    }

    // Get floor price history
    const floorHistoryResponse = await axios.get(`${apiBase}/collections/v5/floor-ask/v1`, {
      params: { 
        id: collectionId,
        normalizeRoyalties: true,
        limit: 30 // Last 30 days
      },
      headers: { 'x-api-key': apiKey }
    });

    const floorHistory = floorHistoryResponse.data.events || [];
    const floorPriceHistory = floorHistory.map(event => ({
      timestamp: event.timestamp,
      price: event.price || 0
    }));

    // Calculate liquidity score (simplified version)
    const liquidityScore = Math.min(
      10,
      (stats.salesCount24h || 0) / (stats.totalSupply || 1) * 1000
    );

    // Calculate whale concentration (simplified)
    const whaleConcentration = 
      collection.ownerDistribution?.top1Percent?.ownership || 0;

    return {
      id: collectionId,
      name: collection.name || collectionId,
      floorPrice: collection.floorAsk?.price?.amount?.native || 0,
      volume24h: stats.volume24h || 0,
      volumeChange24h: stats.volumeChange24h || 0,
      salesCount24h: stats.salesCount24h || 0,
      averagePrice24h: stats.volume24h && stats.salesCount24h 
        ? stats.volume24h / stats.salesCount24h 
        : 0,
      marketCap: collection.marketCap || 0,
      totalSupply: stats.totalSupply || 0,
      ownerCount: stats.ownerCount || 0,
      uniqueBuyers24h: stats.uniqueBuyers24h || 0,
      uniqueSellers24h: stats.uniqueSellers24h || 0,
      liquidityScore,
      priceVolatility,
      whaleConcentration,
      floorPriceHistory
    };
  } catch (error) {
    console.error(`Error getting analytics for collection ${collectionId}:`, error);
    return null;
  }
}

/**
 * Get rarity data for a specific token
 */
export async function getTokenRarity(
  collectionId: string,
  tokenId: string,
  apiKey: string,
  apiBase: string
): Promise<number | null> {
  try {
    const tokenResponse = await axios.get(`${apiBase}/tokens/v6`, {
      params: { 
        collection: collectionId,
        tokenId,
        includeAttributes: true
      },
      headers: { 'x-api-key': apiKey }
    });

    const token = tokenResponse.data.tokens?.[0];
    if (!token) {
      return null;
    }

    // Return rarity rank percentile (lower is rarer)
    if (token.rarityRank && token.collection?.tokenCount) {
      return (token.rarityRank / token.collection.tokenCount) * 100;
    }

    return null;
  } catch (error) {
    console.error(`Error getting rarity for token ${tokenId} in collection ${collectionId}:`, error);
    return null;
  }
}

/**
 * Detect NFTs listed significantly below floor price
 */
export async function detectThinFloors(
  collectionIds: string[],
  priceThreshold: number,
  apiKey: string,
  apiBase: string,
  options: {
    includeRarity?: boolean;
    maxRequestsPerSecond?: number;
    minDiscount?: number;
    maxResults?: number;
  } = {}
): Promise<NotificationPayload[]> {
  const {
    includeRarity = false,
    maxRequestsPerSecond = 5,
    minDiscount = 5, // Minimum 5% discount
    maxResults = 10
  } = options;
  
  const notifications: NotificationPayload[] = [];
  const rateLimiter = new RateLimiter(maxRequestsPerSecond, 1000);

  for (const collectionId of collectionIds) {
    try {
      await rateLimiter.throttle();
      
      // Get collection analytics
      const analytics = await getCollectionAnalytics(collectionId, apiKey, apiBase);
      if (!analytics || !analytics.floorPrice) {
        console.log(`No floor price found for collection ${collectionId}`);
        continue;
      }

      const floorPrice = analytics.floorPrice;
      
      // Skip collections with suspicious activity
      if (
        analytics.priceVolatility > 0.5 || // High volatility
        analytics.whaleConcentration > 0.4 || // High whale concentration
        analytics.liquidityScore < 1 // Low liquidity
      ) {
        console.log(`Skipping collection ${collectionId} due to risk factors`);
        continue;
      }

      await rateLimiter.throttle();
      
      // Get listings
      const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
        params: {
          collection: collectionId,
          sortBy: 'price',
          limit: 50,
          status: 'active'
        },
        headers: { 'x-api-key': apiKey }
      });

      const listings = listingsResponse.data;
      if (!listings?.orders) {
        console.log(`No listings found for collection ${collectionId}`);
        continue;
      }

      for (const listing of listings.orders) {
        if (!listing.price?.amount?.native || !listing.token?.tokenId || !listing.maker) {
          continue;
        }

        const listingPrice = listing.price.amount.native;
        const discount = ((floorPrice - listingPrice) / floorPrice) * 100;
        
        if (discount >= minDiscount) {
          let rarity: number | null = null;
          
          // Get token rarity if requested
          if (includeRarity) {
            await rateLimiter.throttle();
            rarity = await getTokenRarity(
              collectionId,
              listing.token.tokenId,
              apiKey,
              apiBase
            );
          }
          
          notifications.push({
            collectionName: analytics.name,
            collectionId,
            floorPrice,
            listingPrice,
            tokenId: listing.token.tokenId,
            seller: listing.maker,
            discount,
            source: listing.source,
            validUntil: listing.validUntil,
            rarity: rarity || undefined
          });
          
          // Break early if we've reached max results
          if (notifications.length >= maxResults) {
            break;
          }
        }
      }
    } catch (error) {
      console.error(`Error processing collection ${collectionId}:`, error);
    }
  }

  // Sort by discount (highest first)
  return notifications.sort((a, b) => b.discount - a.discount);
}

/**
 * Sweep floor (buy lowest-priced NFTs)
 */
export async function sweepFloor(
  collectionId: string,
  maxPrice: number,
  signer: Signer,
  apiKey: string,
  apiBase: string,
  options: {
    maxItems?: number;
    gasMultiplier?: number;
    maxGasPrice?: number;
    priorityFee?: number;
  } = {}
): Promise<string[]> {
  const {
    maxItems = 1,
    gasMultiplier = 1.1,
    maxGasPrice = 50, // in gwei
    priorityFee = 1.5 // in gwei
  } = options;

  // Get current gas prices
  const gasResponse = await axios.get('https://api.etherscan.io/api', {
    params: {
      module: 'gastracker',
      action: 'gasoracle',
      apikey: process.env.ETHERSCAN_API_KEY || ''
    }
  });
  
  let gasPrice = BigNumber.from(0);
  let maxPriorityFeePerGas = BigNumber.from(0);
  
  if (gasResponse.data?.result?.ProposeGasPrice) {
    // Convert gwei to wei
    const proposedGasPrice = Math.min(
      parseInt(gasResponse.data.result.ProposeGasPrice),
      maxGasPrice
    );
    gasPrice = BigNumber.from(proposedGasPrice).mul(1e9);
    maxPriorityFeePerGas = BigNumber.from(priorityFee).mul(1e9);
  }

  // Get listings below max price
  const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
    params: {
      collection: collectionId,
      maxPrice: maxPrice.toString(),
      sortBy: 'price',
      limit: maxItems,
      status: 'active'
    },
    headers: { 'x-api-key': apiKey }
  });

  const listings = listingsResponse.data;
  if (!listings?.orders?.length) {
    throw new Error('No listings found below max price');
  }

  // Create client
  const client = createClient({
    chains: [{
      id: 1,
      baseApiUrl: apiBase,
      active: true,
      name: 'ethereum'
    }],
    apiKey
  });

  const txHashes: string[] = [];

  // Process each listing
  for (const listing of listings.orders.slice(0, maxItems)) {
    try {
      // Get buy transaction data
      const buyResponse = await axios.post(`${apiBase}/execute/buy/v7`, {
        items: [{
          token: listing.token?.tokenId,
          collection: collectionId,
          quantity: 1
        }],
        source: 'reservoir.tools',
        onlyPath: true, // Get path first to estimate gas
        partial: false
      }, {
        headers: { 'x-api-key': apiKey }
      });

      if (!buyResponse.data?.steps?.[0]?.items?.[0]?.data) {
        console.error('Failed to get buy transaction data');
        continue;
      }

      const txData = buyResponse.data.steps[0].items[0].data;
      
      // Estimate gas
      const gasEstimate = await signer.estimateGas({
        to: txData.to,
        data: txData.data,
        value: BigNumber.from(txData.value)
      });
      
      // Apply gas multiplier for safety
      const adjustedGasLimit = gasEstimate.mul(Math.floor(gasMultiplier * 100)).div(100);
      
      // Execute transaction with optimized gas settings
      const tx = await signer.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: BigNumber.from(txData.value),
        gasLimit: adjustedGasLimit,
        ...(gasPrice.gt(0) ? {
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas
        } : {})
      });

      const receipt = await tx.wait();
      if (receipt) {
        txHashes.push(receipt.transactionHash);
        
        // Add transaction hash to notification
        notify({
          collectionName: listing.collection?.name || collectionId,
          collectionId,
          floorPrice: listing.collection?.floorAskPrice || 0,
          listingPrice: listing.price?.amount?.native || 0,
          tokenId: listing.token?.tokenId || '',
          seller: listing.maker || '',
          discount: ((listing.collection?.floorAskPrice || 0) - (listing.price?.amount?.native || 0)) / 
                   (listing.collection?.floorAskPrice || 1) * 100,
          txHash: receipt.transactionHash,
          estimatedGas: `${ethers.utils.formatEther(receipt.gasUsed.mul(receipt.effectiveGasPrice))} ETH`
        });
      }
    } catch (error) {
      console.error(`Error purchasing token ${listing.token?.tokenId}:`, error);
    }
  }

  return txHashes;
}

/**
 * Monitor collections for opportunities and automatically sweep when good deals appear
 */
export async function autoSweep(
  collectionIds: string[],
  discountThreshold: number,
  maxPricePerItem: number,
  maxTotalSpend: number,
  signer: Signer,
  apiKey: string,
  apiBase: string,
  options: {
    checkIntervalMs?: number;
    includeRarity?: boolean;
    maxItemsPerSweep?: number;
    minRarityPercentile?: number;
  } = {}
): Promise<() => void> {
  const {
    checkIntervalMs = 60000, // Check every minute by default
    includeRarity = true,
    maxItemsPerSweep = 3,
    minRarityPercentile = 50 // Only buy tokens in the top 50% rarity
  } = options;
  
  let totalSpent = 0;
  
  const checkForOpportunities = async () => {
    if (totalSpent >= maxTotalSpend) {
      console.log(`Reached maximum spend limit of ${maxTotalSpend} ETH. Stopping auto-sweep.`);
      return;
    }
    
    try {
      // Look for opportunities
      const opportunities = await detectThinFloors(
        collectionIds,
        discountThreshold / 100, // Convert percentage to decimal
        apiKey,
        apiBase,
        {
          includeRarity,
          maxResults: 50
        }
      );
      
      if (opportunities.length === 0) {
        console.log('No opportunities found. Checking again later.');
        return;
      }
      
      // Filter opportunities by rarity if needed
      const filteredOpportunities = includeRarity
        ? opportunities.filter(o => 
            o.rarity !== undefined && 
            o.rarity <= minRarityPercentile &&
            o.listingPrice <= maxPricePerItem &&
            totalSpent + o.listingPrice <= maxTotalSpend)
        : opportunities.filter(o => 
            o.listingPrice <= maxPricePerItem &&
            totalSpent + o.listingPrice <= maxTotalSpend);
      
      if (filteredOpportunities.length === 0) {
        console.log('No opportunities matching criteria. Checking again later.');
        return;
      }
      
      // Take the best opportunities up to maxItemsPerSweep
      const bestOpportunities = filteredOpportunities
        .slice(0, maxItemsPerSweep);
      
      // Group by collection for efficient sweeping
      const opportunitiesByCollection = bestOpportunities.reduce((acc, opportunity) => {
        if (!acc[opportunity.collectionId]) {
          acc[opportunity.collectionId] = [];
        }
        acc[opportunity.collectionId].push(opportunity);
        return acc;
      }, {} as Record<string, NotificationPayload[]>);
      
      // Sweep each collection
      for (const [collectionId, opportunities] of Object.entries(opportunitiesByCollection)) {
        const maxPrice = Math.max(...opportunities.map(o => o.listingPrice));
        const txHashes = await sweepFloor(
          collectionId,
          maxPrice,
          signer,
          apiKey,
          apiBase,
          {
            maxItems: opportunities.length,
            gasMultiplier: 1.2
          }
        );
        
        // Update total spent
        if (txHashes.length > 0) {
          const spent = opportunities
            .slice(0, txHashes.length)
            .reduce((sum, o) => sum + o.listingPrice, 0);
          
          totalSpent += spent;
          console.log(`Successfully purchased ${txHashes.length} NFTs for a total of ${spent.toFixed(4)} ETH`);
          console.log(`Total spent so far: ${totalSpent.toFixed(4)} ETH of ${maxTotalSpend} ETH budget`);
        }
      }
    } catch (error) {
      console.error('Error in auto-sweep:', error);
    }
  };
  
  // Initial check
  await checkForOpportunities();
  
  // Set up interval for continuous checking
  const intervalId = setInterval(checkForOpportunities, checkIntervalMs);
  
  // Return function to stop monitoring
  return () => clearInterval(intervalId);
} 