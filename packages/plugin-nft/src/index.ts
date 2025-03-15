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
  
  // Register plugin with ElizaOS
  register: () => {
    return {
      actions: {
        getCollectionAnalytics,
        getTokenRarity,
        detectThinFloors,
        sweepFloor,
        autoSweep
      },
      providers: {}
    };
  }
}; 