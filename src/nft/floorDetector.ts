import { createClient } from '@reservoir0x/reservoir-sdk';
import { type Signer } from 'ethers';
import axios from 'axios';

// Export types instead of interfaces to avoid conflicts
export type NFTCollection = {
  id: string;
  name: string;
  floorPrice: number;
};

export type NFTListing = {
  id: string;
  tokenId: string;
  price: number;
  maker: string;
};

interface NotificationPayload {
  collectionName: string;
  floorPrice: number;
  listingPrice: number;
  tokenId: string;
  seller: string;
  txHash?: string;
}

function notify(payload: NotificationPayload) {
  console.log('[Notification]:', `${payload.collectionName} - Token #${payload.tokenId} listed at ${payload.listingPrice} ETH (Floor: ${payload.floorPrice} ETH)`);
  if (payload.txHash) {
    console.log('Transaction Hash:', payload.txHash);
  }
}

export async function detectThinFloors(
  collectionIds: string[],
  priceThreshold: number,
  apiKey: string,
  apiBase: string
): Promise<NotificationPayload[]> {
  const notifications: NotificationPayload[] = [];

  for (const collectionId of collectionIds) {
    try {
      // Get collection details
      const collectionResponse = await axios.get(`${apiBase}/collections/v5`, {
        params: { id: collectionId },
        headers: { 'x-api-key': apiKey }
      });

      const collection = collectionResponse.data.collections?.[0];
      if (!collection?.floorAsk?.price?.amount?.native) {
        console.log(`No floor price found for collection ${collectionId}`);
        continue;
      }

      const floorPrice = collection.floorAsk.price.amount.native;

      // Get listings
      const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
        params: {
          collection: collectionId,
          sortBy: 'price',
          limit: 50
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
        if (listingPrice <= floorPrice * (1 - priceThreshold)) {
          notifications.push({
            collectionName: collection.name || collectionId,
            floorPrice,
            listingPrice,
            tokenId: listing.token.tokenId,
            seller: listing.maker
          });
        }
      }
    } catch (error) {
      console.error(`Error processing collection ${collectionId}:`, error);
    }
  }

  return notifications;
}

export async function sweepFloor(
  collectionId: string,
  maxPrice: number,
  signer: Signer,
  apiKey: string,
  apiBase: string
): Promise<string> {
  // Get listings below max price
  const listingsResponse = await axios.get(`${apiBase}/orders/asks/v4`, {
    params: {
      collection: collectionId,
      maxPrice: maxPrice.toString(),
      sortBy: 'price',
      limit: 1
    },
    headers: { 'x-api-key': apiKey }
  });

  const listings = listingsResponse.data;
  if (!listings?.orders?.[0]) {
    throw new Error('No listings found below max price');
  }

  const listing = listings.orders[0];

  // Execute buy using SDK for transaction execution
  const client = createClient({
    chains: [{
      id: 1,
      baseApiUrl: apiBase,
      active: true,
      name: 'ethereum'
    }],
    apiKey
  });

  const buyResponse = await axios.post(`${apiBase}/execute/buy/v7`, {
    items: [{
      token: listing.token?.tokenId,
      collection: collectionId,
      quantity: 1
    }],
    source: 'reservoir.tools'
  }, {
    headers: { 'x-api-key': apiKey }
  });

  if (!buyResponse.data?.steps?.[0]?.items?.[0]?.data) {
    throw new Error('Failed to get buy transaction data');
  }

  const txData = buyResponse.data.steps[0].items[0].data;
  const tx = await signer.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: txData.value,
    gasLimit: txData.gas
  });

  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Failed to get transaction receipt');
  }

  return receipt.transactionHash;
} 