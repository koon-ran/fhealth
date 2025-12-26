/**
 * FHEVM Context - Shared context for FHEVM functionality
 * Separated for Fast Refresh compatibility
 * Following Aruvi pattern: https://github.com/ramakrishnanhulk20/Aruvi
 */

import { createContext } from 'react';
import type { FhevmInstance } from './FhevmProvider';

// Context types
export interface FhevmContextType {
  instance: FhevmInstance | null;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  initialize: () => Promise<void>;
}

export const FhevmContext = createContext<FhevmContextType>({
  instance: null,
  isReady: false,
  isLoading: false,
  error: null,
  initialize: async () => {},
});
