import { ReservoirKitProvider as ReservoirProvider } from '@reservoir0x/reservoir-kit-ui';
import { createConfig, WagmiConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { http } from 'viem';
import { ReactNode } from 'react';

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http()
  }
});

interface ReservoirKitProviderProps {
  children: ReactNode;
}

export function ReservoirKitProvider({ children }: ReservoirKitProviderProps) {
  return (
    <WagmiConfig config={config}>
      <ReservoirProvider
        options={{
          chains: [
            {
              id: sepolia.id,
              baseApiUrl: 'https://api-sepolia.reservoir.tools',
              default: true,
            },
          ],
          source: 'bouncer-eliza-agent',
        }}
      >
        {children}
      </ReservoirProvider>
    </WagmiConfig>
  );
} 