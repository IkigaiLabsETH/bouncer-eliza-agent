// Environment configuration for the NFT plugin

export interface NFTPluginConfig {
  // API keys
  reservoirApiKey: string;
  etherscanApiKey?: string;
  
  // Network configuration
  rpcUrl?: string;
  
  // Default settings
  defaultApiBase: string;
  defaultMaxRequestsPerSecond: number;
  defaultCheckIntervalMs: number;
  defaultGasMultiplier: number;
  defaultMaxGasPrice: number;
  defaultPriorityFee: number;
}

// Default configuration
export const defaultConfig: NFTPluginConfig = {
  reservoirApiKey: process.env.RESERVOIR_API_KEY || '',
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  rpcUrl: process.env.RPC_URL,
  defaultApiBase: 'https://api.reservoir.tools',
  defaultMaxRequestsPerSecond: 5,
  defaultCheckIntervalMs: 60000, // 1 minute
  defaultGasMultiplier: 1.1,
  defaultMaxGasPrice: 50, // 50 gwei
  defaultPriorityFee: 1.5 // 1.5 gwei
};

// Get configuration with overrides
export function getConfig(overrides: Partial<NFTPluginConfig> = {}): NFTPluginConfig {
  return {
    ...defaultConfig,
    ...overrides
  };
} 