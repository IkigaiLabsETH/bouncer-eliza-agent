import { createClient } from '@reservoir0x/reservoir-sdk';
import { type Signer, BigNumber, ethers } from 'ethers';
import axios from 'axios';
import { NFTCollection, NFTListing, CollectionAnalytics, NotificationPayload } from '../types';
import { getConfig } from '../environment';
import { 
  formatEth, 
  formatPercent, 
  getGasPrices, 
  calculateRiskScore, 
  parseCollectionIds, 
  sleep, 
  formatTimestamp, 
  calculateEstimatedProfit 
} from '../providers/helpers';

// Rate limiter for API requests
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
    const timeElapsed = now - this.lastRequestTime;

    // Reset window if enough time has passed
    if (timeElapsed > this.windowMs) {
      this.requestsInWindow = 0;
      this.lastRequestTime = now;
      return;
    }

    // Check if we've hit the rate limit
    if (this.requestsInWindow >= this.maxRequestsPerWindow) {
      // Calculate time to wait
      const timeToWait = this.windowMs - timeElapsed;
      
      // Wait until the window resets
      await sleep(timeToWait);
      
      // Reset counters
      this.requestsInWindow = 0;
      this.lastRequestTime = Date.now();
    } else {
      // Increment request counter
      this.requestsInWindow++;
    }
  }
}

// Notification function (can be customized)
function notify(payload: NotificationPayload) {
  console.log('NFT Opportunity Detected:');
  console.log(`Collection: ${payload.collectionName} (${payload.collectionId})`);
  console.log(`Token ID: ${payload.tokenId}`);
  console.log(`Price: ${formatEth(payload.listingPrice)} ETH (${formatPercent(-payload.discount)} below floor)`);
  console.log(`Floor Price: ${formatEth(payload.floorPrice)} ETH`);
  console.log(`Seller: ${payload.seller}`);
  
  if (payload.source) {
    console.log(`Source: ${payload.source}`);
  }
  
  if (payload.validUntil) {
    console.log(`Valid Until: ${formatTimestamp(payload.validUntil)}`);
  }
  
  if (payload.rarity !== undefined) {
    console.log(`Rarity: Top ${payload.rarity}%`);
  }
  
  if (payload.estimatedGas) {
    console.log(`Estimated Gas: ${payload.estimatedGas} ETH`);
  }
  
  console.log('---');
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
    // Get collection stats
    const statsResponse = await axios.get(`${apiBase}/collections/v5`, {
      params: {
        id: collectionId,
        includeTopBid: true,
        includeAttributes: false
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    if (!statsResponse.data?.collections?.[0]) {
      console.error(`Collection not found: ${collectionId}`);
      return null;
    }
    
    const collection = statsResponse.data.collections[0];
    
    // Get sales history
    const salesResponse = await axios.get(`${apiBase}/sales/v4`, {
      params: {
        collection: collectionId,
        limit: 100,
        sortBy: 'timestamp',
        sortDirection: 'desc'
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    // Get floor price history
    const historyResponse = await axios.get(`${apiBase}/collections/v5/${collectionId}/floorask/v1`, {
      params: {
        includeRawData: false,
        normalizeRoyalties: true
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    // Calculate additional metrics
    const sales = salesResponse.data?.sales || [];
    const last24hSales = sales.filter((sale: any) => {
      const saleTime = new Date(sale.timestamp).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return saleTime >= oneDayAgo;
    });
    
    // Calculate unique buyers and sellers in last 24h
    const uniqueBuyers = new Set(last24hSales.map((sale: any) => sale.to));
    const uniqueSellers = new Set(last24hSales.map((sale: any) => sale.from));
    
    // Calculate average price in last 24h
    const totalVolume = last24hSales.reduce((sum: number, sale: any) => {
      return sum + (parseFloat(sale.price) || 0);
    }, 0);
    
    const averagePrice = last24hSales.length > 0 
      ? totalVolume / last24hSales.length 
      : 0;
    
    // Calculate price volatility (standard deviation of prices)
    const prices = last24hSales.map((sale: any) => parseFloat(sale.price) || 0);
    const pricesMean = prices.length > 0 
      ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length 
      : 0;
    
    const priceVariance = prices.length > 0
      ? prices.reduce((sum: number, price: number) => sum + Math.pow(price - pricesMean, 2), 0) / prices.length
      : 0;
    
    const priceVolatility = Math.sqrt(priceVariance) / (pricesMean || 1);
    
    // Calculate whale concentration (percentage of tokens owned by top 10 holders)
    // This is a placeholder - actual implementation would require additional API calls
    const whaleConcentration = collection.ownerCount > 0
      ? Math.min(1, 10 / collection.ownerCount)
      : 0;
    
    // Calculate liquidity score (0-10, higher is more liquid)
    const liquidityScore = Math.min(10, (
      (last24hSales.length / Math.max(1, collection.tokenCount * 0.01)) + // Sales relative to collection size
      (uniqueBuyers.size / Math.max(1, last24hSales.length)) + // Buyer diversity
      (collection.floorAsk?.price ? 5 : 0) // Has active listings
    ) / 3 * 10);
    
    // Format floor price history
    const floorPriceHistory = historyResponse.data?.prices?.map((point: any) => ({
      timestamp: new Date(point.timestamp).getTime() / 1000,
      price: parseFloat(point.price)
    })) || [];
    
    return {
      id: collectionId,
      name: collection.name,
      floorPrice: parseFloat(collection.floorAsk?.price || '0'),
      volume24h: parseFloat(collection.volume?.['1day'] || '0'),
      volumeChange24h: parseFloat(collection.volumeChange?.['1day'] || '0'),
      salesCount24h: last24hSales.length,
      averagePrice24h: averagePrice,
      marketCap: parseFloat(collection.floorAsk?.price || '0') * (collection.tokenCount || 0),
      totalSupply: collection.tokenCount || 0,
      ownerCount: collection.ownerCount || 0,
      uniqueBuyers24h: uniqueBuyers.size,
      uniqueSellers24h: uniqueSellers.size,
      liquidityScore,
      priceVolatility,
      whaleConcentration,
      floorPriceHistory
    };
  } catch (error) {
    console.error('Error fetching collection analytics:', error);
    return null;
  }
}

/**
 * Get rarity data for a specific token in a collection
 */
export async function getTokenRarity(
  collectionId: string,
  tokenId: string,
  apiKey: string,
  apiBase: string
): Promise<number | null> {
  try {
    const response = await axios.get(`${apiBase}/tokens/v5`, {
      params: {
        collection: collectionId,
        tokenId,
        includeAttributes: true
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    if (!response.data?.tokens?.[0]) {
      console.error(`Token not found: ${collectionId}:${tokenId}`);
      return null;
    }
    
    const token = response.data.tokens[0];
    
    // Return rarity rank as percentile (lower is rarer)
    if (token.rarityRank && token.collection?.tokenCount) {
      return (token.rarityRank / token.collection.tokenCount) * 100;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching token rarity:', error);
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
  // Set default options
  const {
    includeRarity = false,
    maxRequestsPerSecond = 5,
    minDiscount = 5, // Minimum 5% discount
    maxResults = 10
  } = options;
  
  // Create rate limiter
  const rateLimiter = new RateLimiter(maxRequestsPerSecond);
  
  // Store results
  const opportunities: NotificationPayload[] = [];
  
  // Process each collection
  for (const collectionId of collectionIds) {
    try {
      // Throttle requests
      await rateLimiter.throttle();
      
      // Get collection analytics
      const analytics = await getCollectionAnalytics(collectionId, apiKey, apiBase);
      
      if (!analytics || !analytics.floorPrice) {
        console.warn(`Skipping collection ${collectionId}: No floor price data`);
        continue;
      }
      
      // Calculate risk score
      const riskScore = calculateRiskScore(
        analytics.priceVolatility,
        analytics.whaleConcentration,
        analytics.liquidityScore / 10, // Normalize to 0-1
        analytics.volumeChange24h
      );
      
      // Skip high-risk collections
      if (riskScore > 70) {
        console.warn(`Skipping high-risk collection ${analytics.name}: Risk score ${riskScore}/100`);
        continue;
      }
      
      // Calculate price threshold
      const maxPrice = analytics.floorPrice * (1 - priceThreshold);
      
      // Get listings below threshold
      await rateLimiter.throttle();
      
      const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
        params: {
          collection: collectionId,
          sortBy: 'price',
          sortDirection: 'asc',
          status: 'active',
          normalizeRoyalties: true,
          limit: 50
        },
        headers: {
          'x-api-key': apiKey
        }
      });
      
      const listings = listingsResponse.data?.orders || [];
      
      // Filter listings below threshold
      for (const listing of listings) {
        const price = parseFloat(listing.price);
        
        // Skip if price is above threshold
        if (price > maxPrice) {
          continue;
        }
        
        // Calculate discount percentage
        const discount = ((analytics.floorPrice - price) / analytics.floorPrice) * 100;
        
        // Skip if discount is below minimum
        if (discount < minDiscount) {
          continue;
        }
        
        // Get token rarity if enabled
        let rarity: number | undefined = undefined;
        if (includeRarity) {
          await rateLimiter.throttle();
          const rarityValue = await getTokenRarity(collectionId, listing.criteria?.data?.token?.tokenId, apiKey, apiBase);
          if (rarityValue !== null) {
            rarity = rarityValue;
          }
        }
        
        // Add to opportunities
        opportunities.push({
          collectionName: analytics.name,
          collectionId,
          floorPrice: analytics.floorPrice,
          listingPrice: price,
          tokenId: listing.criteria?.data?.token?.tokenId,
          seller: listing.maker,
          discount,
          source: listing.source,
          validUntil: listing.validUntil,
          rarity
        });
        
        // Break if we've reached max results
        if (opportunities.length >= maxResults) {
          break;
        }
      }
      
      // Break if we've reached max results
      if (opportunities.length >= maxResults) {
        break;
      }
    } catch (error) {
      console.error(`Error processing collection ${collectionId}:`, error);
    }
  }
  
  // Sort by discount (highest first)
  opportunities.sort((a, b) => b.discount - a.discount);
  
  // Notify about opportunities
  opportunities.forEach(notify);
  
  return opportunities.slice(0, maxResults);
}

/**
 * Buy NFTs listed below the specified maximum price
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
  // Set default options
  const {
    maxItems = 1,
    gasMultiplier = 1.1,
    maxGasPrice = 50, // 50 gwei
    priorityFee = 1.5 // 1.5 gwei
  } = options;
  
  // Initialize Reservoir SDK
  // @ts-ignore - Bypass type checking for Reservoir SDK
  const reservoirClient = createClient({
    chains: [{
      id: 1,
      baseApiUrl: apiBase,
      name: 'ethereum',
      active: true
    }],
    apiKey,
    source: 'nft-floor-detector'
  });
  
  try {
    // Get listings below max price
    const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
      params: {
        collection: collectionId,
        sortBy: 'price',
        sortDirection: 'asc',
        status: 'active',
        normalizeRoyalties: true,
        limit: maxItems
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    const listings = listingsResponse.data?.orders || [];
    
    // Filter listings below max price
    const eligibleListings = listings.filter((listing: any) => {
      const price = parseFloat(listing.price);
      return price <= maxPrice;
    });
    
    if (eligibleListings.length === 0) {
      console.log(`No listings found below ${maxPrice} ETH for collection ${collectionId}`);
      return [];
    }
    
    console.log(`Found ${eligibleListings.length} listings below ${maxPrice} ETH for collection ${collectionId}`);
    
    // Get collection info
    const collectionResponse = await axios.get(`${apiBase}/collections/v5`, {
      params: {
        id: collectionId
      },
      headers: {
        'x-api-key': apiKey
      }
    });
    
    const collection = collectionResponse.data?.collections?.[0];
    
    if (!collection) {
      console.error(`Collection not found: ${collectionId}`);
      return [];
    }
    
    // Get gas prices
    const etherscanApiKey = getConfig().etherscanApiKey;
    let gasPrices = null;
    
    if (etherscanApiKey) {
      gasPrices = await getGasPrices(etherscanApiKey);
    }
    
    // Set gas price
    let gasPrice = ethers.utils.parseUnits(priorityFee.toString(), 'gwei');
    
    if (gasPrices) {
      gasPrice = gasPrices.fast;
      
      // Cap gas price
      const maxGasPriceWei = ethers.utils.parseUnits(maxGasPrice.toString(), 'gwei');
      if (gasPrice.gt(maxGasPriceWei)) {
        console.log(`Capping gas price to ${maxGasPrice} gwei`);
        gasPrice = maxGasPriceWei;
      }
    }
    
    // Execute purchases
    const txHashes: string[] = [];
    
    for (const listing of eligibleListings.slice(0, maxItems)) {
      try {
        const price = parseFloat(listing.price);
        const tokenId = listing.criteria?.data?.token?.tokenId;
        
        console.log(`Attempting to purchase ${collection.name} #${tokenId} for ${price} ETH`);
        
        // Prepare transaction
        // @ts-ignore - Bypass type checking for Reservoir SDK
        const executeResponse = await reservoirClient.actions.buyToken({
          items: [{
            collection: collectionId,
            token: tokenId,
            quantity: 1,
            exactOrderIds: [listing.id]
          }],
          options: {
            currencyType: 'ETH'
          },
          onProgress: (steps) => {
            console.log(`Progress: ${steps.length} steps completed`);
          }
        });
        
        // Check if response exists and has path property
        // @ts-ignore - Bypass type checking for Reservoir SDK response
        if (!executeResponse || typeof executeResponse === 'boolean' || !executeResponse.path?.[0]?.data) {
          console.error('No transaction data returned');
          continue;
        }
        
        // Get transaction data
        // @ts-ignore - Bypass type checking for Reservoir SDK response
        const txData = executeResponse.path[0].data;
        
        // Estimate gas
        const gasEstimate = await signer.estimateGas({
          to: txData.to,
          data: txData.data,
          value: ethers.BigNumber.from(txData.value)
        });
        
        // Add buffer to gas estimate
        const gasLimit = gasEstimate.mul(Math.floor(gasMultiplier * 100)).div(100);
        
        // Send transaction
        const tx = await signer.sendTransaction({
          to: txData.to,
          data: txData.data,
          value: ethers.BigNumber.from(txData.value),
          gasLimit,
          gasPrice
        });
        
        console.log(`Transaction sent: ${tx.hash}`);
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        
        console.log(`Transaction confirmed: ${receipt.transactionHash}`);
        txHashes.push(receipt.transactionHash);
        
        // Notify about purchase
        notify({
          collectionName: collection.name,
          collectionId,
          floorPrice: parseFloat(collection.floorAsk?.price || '0'),
          listingPrice: price,
          tokenId,
          seller: listing.maker,
          discount: ((parseFloat(collection.floorAsk?.price || '0') - price) / parseFloat(collection.floorAsk?.price || '1')) * 100,
          source: listing.source,
          txHash: receipt.transactionHash,
          estimatedGas: formatEth(ethers.utils.formatEther(gasPrice.mul(receipt.gasUsed)))
        });
      } catch (error) {
        console.error(`Error purchasing token:`, error);
      }
    }
    
    return txHashes;
  } catch (error) {
    console.error('Error sweeping floor:', error);
    return [];
  }
}

/**
 * Continuously monitor collections and automatically purchase NFTs when they meet criteria
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
  // Set default options
  const {
    checkIntervalMs = 60000, // Check every minute
    includeRarity = true,
    maxItemsPerSweep = 3,
    minRarityPercentile = 50 // Top 50% rarity
  } = options;
  
  let totalSpent = 0;
  let isRunning = true;
  
  // Function to check for opportunities
  const checkForOpportunities = async () => {
    if (!isRunning) return;
    
    try {
      console.log(`Checking for opportunities across ${collectionIds.length} collections...`);
      
      // Detect thin floors
      const opportunities = await detectThinFloors(
        collectionIds,
        discountThreshold / 100, // Convert percentage to decimal
        apiKey,
        apiBase,
        {
          includeRarity,
          maxResults: maxItemsPerSweep * 2, // Get more results than we need to filter by rarity
          minDiscount: discountThreshold
        }
      );
      
      // Filter by rarity if enabled
      const filteredOpportunities = includeRarity
        ? opportunities.filter(opp => opp.rarity !== undefined && opp.rarity <= minRarityPercentile)
        : opportunities;
      
      // Sort by discount (highest first)
      filteredOpportunities.sort((a, b) => b.discount - a.discount);
      
      // Limit to max items
      const topOpportunities = filteredOpportunities.slice(0, maxItemsPerSweep);
      
      if (topOpportunities.length === 0) {
        console.log('No suitable opportunities found');
        return;
      }
      
      console.log(`Found ${topOpportunities.length} suitable opportunities`);
      
      // Calculate potential spend
      const potentialSpend = topOpportunities.reduce((sum, opp) => sum + opp.listingPrice, 0);
      
      // Check if we have enough budget
      if (totalSpent + potentialSpend > maxTotalSpend) {
        console.log(`Budget limit reached: ${totalSpent} ETH spent out of ${maxTotalSpend} ETH maximum`);
        
        // Find opportunities that fit within remaining budget
        let remainingBudget = maxTotalSpend - totalSpent;
        const affordableOpportunities = [];
        
        for (const opp of topOpportunities) {
          if (opp.listingPrice <= remainingBudget) {
            affordableOpportunities.push(opp);
            remainingBudget -= opp.listingPrice;
          }
        }
        
        if (affordableOpportunities.length === 0) {
          console.log('No affordable opportunities within remaining budget');
          return;
        }
        
        console.log(`Found ${affordableOpportunities.length} affordable opportunities within remaining budget`);
        
        // Execute purchases for each collection
        for (const opp of affordableOpportunities) {
          // Skip if price exceeds max price per item
          if (opp.listingPrice > maxPricePerItem) {
            console.log(`Skipping opportunity: Price ${opp.listingPrice} ETH exceeds max price per item ${maxPricePerItem} ETH`);
            continue;
          }
          
          // Execute purchase
          const txHashes = await sweepFloor(
            opp.collectionId,
            opp.listingPrice * 1.01, // Add 1% buffer for price changes
            signer,
            apiKey,
            apiBase,
            {
              maxItems: 1 // Buy one at a time
            }
          );
          
          if (txHashes.length > 0) {
            totalSpent += opp.listingPrice;
            console.log(`Total spent: ${totalSpent} ETH out of ${maxTotalSpend} ETH maximum`);
          }
        }
      } else {
        // Execute purchases for each collection
        for (const opp of topOpportunities) {
          // Skip if price exceeds max price per item
          if (opp.listingPrice > maxPricePerItem) {
            console.log(`Skipping opportunity: Price ${opp.listingPrice} ETH exceeds max price per item ${maxPricePerItem} ETH`);
            continue;
          }
          
          // Execute purchase
          const txHashes = await sweepFloor(
            opp.collectionId,
            opp.listingPrice * 1.01, // Add 1% buffer for price changes
            signer,
            apiKey,
            apiBase,
            {
              maxItems: 1 // Buy one at a time
            }
          );
          
          if (txHashes.length > 0) {
            totalSpent += opp.listingPrice;
            console.log(`Total spent: ${totalSpent} ETH out of ${maxTotalSpend} ETH maximum`);
            
            // Check if we've reached the budget limit
            if (totalSpent >= maxTotalSpend) {
              console.log(`Budget limit reached: ${totalSpent} ETH spent out of ${maxTotalSpend} ETH maximum`);
              isRunning = false;
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-sweep:', error);
    }
    
    // Schedule next check if still running
    if (isRunning) {
      setTimeout(checkForOpportunities, checkIntervalMs);
    }
  };
  
  // Start checking
  checkForOpportunities();
  
  // Return function to stop auto-sweep
  return () => {
    console.log('Stopping auto-sweep');
    isRunning = false;
  };
} 