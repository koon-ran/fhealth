'use client'

import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from '@/lib/wagmi'
import { ReactNode, useState } from 'react'
import { FhevmProvider } from '@/lib/fhevm'
import GatewayOperatorPrompt from './GatewayOperatorPrompt'

const customTheme = darkTheme({
  accentColor: '#3ECFB2',
  accentColorForeground: '#000000',
  borderRadius: 'none',
  fontStack: 'system',
})

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          <FhevmProvider>
            {children}
            <GatewayOperatorPrompt />
          </FhevmProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
