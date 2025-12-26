/**
 * Hook to access FHEVM context
 * Separated from FhevmProvider for Fast Refresh compatibility
 * Following Aruvi pattern
 */

import { useContext } from 'react';
import { FhevmContext } from './FhevmContext';

export function useFhevm() {
  return useContext(FhevmContext);
}
