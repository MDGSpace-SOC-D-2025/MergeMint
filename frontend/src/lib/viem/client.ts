import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { sepolia } from 'viem/chains';

// Use Alchemy or Infura for better rate limits
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.sepolia.org';

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL, {
    retryCount: 3,
    retryDelay: 1000,
  })
});

export function getWalletClient() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet detected');
  }

  return createWalletClient({
    chain: sepolia,
    transport: custom(window.ethereum)
  });
}

export { sepolia };