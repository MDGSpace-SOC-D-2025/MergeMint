'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ConnectButton } from '@/components/ConnectButton';
import { BountyForm } from '@/components/BountyForm';
import { useWallet } from '@/contexts/WalletContext';
import { GitPullRequest, ArrowLeft } from 'lucide-react';

export default function CreateBountyPage() {
  const router = useRouter();
  const { isConnected } = useWallet();

  const handleSuccess = () => {
    // Redirect to bounties page after successful creation
    router.push('/bounties');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <Link href="/" className="flex items-center gap-2">
              <GitPullRequest className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                MergeMint
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/bounties"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Browse Bounties
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link
          href="/bounties"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 
                   hover:text-gray-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bounties
        </Link>

        {/* Not Connected State */}
        {!isConnected && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <GitPullRequest className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Connect Your Wallet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              You need to connect your wallet to create a bounty
            </p>
            <ConnectButton />
          </div>
        )}

        {/* Connected State - Show Form */}
        {isConnected && (
          <BountyForm onSuccess={handleSuccess} />
        )}
      </main>
    </div>
  );
}