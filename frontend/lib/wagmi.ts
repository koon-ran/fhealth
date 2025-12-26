import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'viem'
import { sepolia } from 'viem/chains'

// Wagmi configuration (Sepolia with Alchemy RPC)
export const config = getDefaultConfig({
  appName: 'Arcscrow',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0000000000000000000000000000000a',
  chains: [sepolia],
  transports: {
    [sepolia.id]: http('https://eth-sepolia.g.alchemy.com/v2/hzD6zJIov03vth52NR3QG'),
  },
  ssr: true,
})
