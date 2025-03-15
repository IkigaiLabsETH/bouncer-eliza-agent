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

export interface NotificationPayload {
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