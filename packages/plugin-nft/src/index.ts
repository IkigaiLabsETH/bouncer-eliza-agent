import { NFTCollection, NFTListing, CollectionAnalytics, NotificationPayload } from './types';
import { getCollectionAnalytics, getTokenRarity, detectThinFloors, sweepFloor, autoSweep } from './actions/floorDetector';

// Export all types and functions
export {
  // Types
  NFTCollection,
  NFTListing,
  CollectionAnalytics,
  NotificationPayload,
  
  // Functions
  getCollectionAnalytics,
  getTokenRarity,
  detectThinFloors,
  sweepFloor,
  autoSweep
};

// Plugin entry point
export default {
  name: 'nft',
  version: '1.0.0',
  description: 'NFT Floor Price Detection and Sweeping Plugin for ElizaOS',
  
  // Register plugin with ElizaOS
  register: (runtime?: any) => {
    return {
      actions: {
        getCollectionAnalytics: (params: any) => getCollectionAnalytics(
          params.collectionId,
          params.apiKey,
          params.apiBase
        ),
        getTokenRarity: (params: any) => getTokenRarity(
          params.collectionId,
          params.tokenId,
          params.apiKey,
          params.apiBase
        ),
        detectThinFloors: (params: any) => detectThinFloors(
          params.collectionIds,
          params.priceThreshold,
          params.apiKey,
          params.apiBase,
          params.options,
          runtime
        ),
        sweepFloor: (params: any) => sweepFloor(
          params.collectionId,
          params.maxPrice,
          params.signer,
          params.apiKey,
          params.apiBase,
          params.options,
          runtime
        ),
        autoSweep: (params: any) => autoSweep(
          params.collectionIds,
          params.discountThreshold,
          params.maxPricePerItem,
          params.maxTotalSpend,
          params.signer,
          params.apiKey,
          params.apiBase,
          params.options,
          runtime
        )
      },
      providers: {}
    };
  }
}; 