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

// Default configuration without runtime
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

// Get configuration with runtime and overrides
export function getConfig(runtime?: any, overrides: Partial<NFTPluginConfig> = {}): NFTPluginConfig {
  // If runtime is provided, use getSetting to get values
  if (runtime) {
    return {
      reservoirApiKey: runtime.getSetting("RESERVOIR_API_KEY") || process.env.RESERVOIR_API_KEY || '',
      etherscanApiKey: runtime.getSetting("ETHERSCAN_API_KEY") || process.env.ETHERSCAN_API_KEY,
      rpcUrl: runtime.getSetting("RPC_URL") || process.env.RPC_URL,
      defaultApiBase: runtime.getSetting("DEFAULT_API_BASE") || 'https://api.reservoir.tools',
      defaultMaxRequestsPerSecond: runtime.getSetting("DEFAULT_MAX_REQUESTS_PER_SECOND") || 5,
      defaultCheckIntervalMs: runtime.getSetting("DEFAULT_CHECK_INTERVAL_MS") || 60000,
      defaultGasMultiplier: runtime.getSetting("DEFAULT_GAS_MULTIPLIER") || 1.1,
      defaultMaxGasPrice: runtime.getSetting("DEFAULT_MAX_GAS_PRICE") || 50,
      defaultPriorityFee: runtime.getSetting("DEFAULT_PRIORITY_FEE") || 1.5,
      ...overrides
    };
  }
  
  // If no runtime, use default config with overrides
  return {
    ...defaultConfig,
    ...overrides
  };
} 