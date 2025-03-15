import { BigNumber } from 'ethers';
import axios from 'axios';

/**
 * Format ETH value with appropriate precision
 */
export function formatEth(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (num >= 1) {
    return num.toFixed(3);
  } else if (num >= 0.001) {
    return num.toFixed(4);
  } else {
    return num.toFixed(6);
  }
}

/**
 * Format percentage with appropriate sign
 */
export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Get current gas prices from Etherscan
 */
export async function getGasPrices(etherscanApiKey: string): Promise<{
  standard: BigNumber;
  fast: BigNumber;
  rapid: BigNumber;
} | null> {
  try {
    const response = await axios.get('https://api.etherscan.io/api', {
      params: {
        module: 'gastracker',
        action: 'gasoracle',
        apikey: etherscanApiKey
      }
    });
    
    if (response.data?.status === '1' && response.data?.result) {
      const result = response.data.result;
      
      // Convert gwei to wei (multiply by 10^9)
      return {
        standard: BigNumber.from(Math.round(parseFloat(result.SafeGasPrice))).mul(1e9),
        fast: BigNumber.from(Math.round(parseFloat(result.ProposeGasPrice))).mul(1e9),
        rapid: BigNumber.from(Math.round(parseFloat(result.FastGasPrice))).mul(1e9)
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching gas prices:', error);
    return null;
  }
}

/**
 * Calculate risk score for a collection (0-100, lower is safer)
 */
export function calculateRiskScore(
  priceVolatility: number,
  whaleConcentration: number,
  liquidityScore: number,
  volumeChange24h: number
): number {
  // Normalize inputs to 0-100 scale
  const volatilityScore = Math.min(100, priceVolatility * 100);
  const whaleScore = Math.min(100, whaleConcentration * 100);
  const liquidityInverseScore = Math.max(0, 100 - (liquidityScore * 10));
  
  // Volume change can be positive or negative
  // Extreme changes in either direction increase risk
  const volumeChangeAbs = Math.abs(volumeChange24h);
  const volumeChangeScore = Math.min(100, volumeChangeAbs > 100 ? 100 : volumeChangeAbs);
  
  // Weighted average of risk factors
  const weightedScore = (
    (volatilityScore * 0.3) +
    (whaleScore * 0.3) +
    (liquidityInverseScore * 0.25) +
    (volumeChangeScore * 0.15)
  );
  
  return Math.round(weightedScore);
}

/**
 * Parse comma-separated collection IDs from environment variable
 */
export function parseCollectionIds(envVar: string | undefined): string[] {
  if (!envVar) return [];
  
  return envVar
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0 && id.startsWith('0x'));
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp to human-readable date
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

/**
 * Calculate estimated profit from a potential NFT purchase
 */
export function calculateEstimatedProfit(
  listingPrice: number,
  floorPrice: number,
  estimatedGasCost: number,
  marketplaceFee: number = 0.025 // Default 2.5% marketplace fee
): {
  profit: number;
  roi: number;
} {
  // Calculate selling price after fees
  const sellingPrice = floorPrice * (1 - marketplaceFee);
  
  // Calculate profit
  const profit = sellingPrice - listingPrice - estimatedGasCost;
  
  // Calculate ROI
  const totalCost = listingPrice + estimatedGasCost;
  const roi = (profit / totalCost) * 100;
  
  return { profit, roi };
} 