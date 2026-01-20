'use client';

import { useWallet } from '@/contexts/WalletContext';
import { Wallet, LogOut } from 'lucide-react';

export function ConnectButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-green-100 dark:bg-green-900/20 px-4 py-2 rounded-lg">
          <span className="text-sm font-mono text-green-800 dark:text-green-300">
            {formatAddress(address)}
          </span>
        </div>
        <button
          onClick={disconnect}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          title="Disconnect"
        >
          <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 
                 text-white px-6 py-2 rounded-lg font-medium transition-colors"
    >
      <Wallet className="w-5 h-5" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
}