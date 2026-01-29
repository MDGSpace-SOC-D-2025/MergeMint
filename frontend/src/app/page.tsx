'use client';

import Link from 'next/link';
import { ConnectButton } from '@/components/ConnectButton';
import { useWallet } from '@/contexts/WalletContext';
import { GitPullRequest, Shield, Zap, TrendingUp } from 'lucide-react';

export default function Home() {
  const { isConnected } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-8 h-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                MergeMint
              </span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Decentralized Bounties for
            <span className="block text-blue-600">Open Source Contributors</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
            Fund GitHub issues with crypto and automatically reward contributors when their PRs get merged.
            Powered by Chainlink oracles for trustless verification.
          </p>
          <div className="flex gap-4 justify-center">
            {isConnected ? (
              <>
                <Link
                  href="/bounties/create"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg 
                           font-medium transition-colors"
                >
                  Create Bounty
                </Link>
                <Link
                  href="/bounties"
                  className="border border-gray-300 dark:border-gray-700 px-8 py-3 rounded-lg 
                           font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Browse Bounties
                </Link>
              </>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                Connect your wallet to get started
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Shield className="w-8 h-8 text-blue-600" />}
            title="Trustless Verification"
            description="Chainlink oracles automatically verify merged PRs and trigger payments. No middleman needed."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8 text-blue-600" />}
            title="Instant Payments"
            description="Contributors receive USDC instantly when their PR is merged and verified on-chain."
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
            title="Premium Context"
            description="Access AI-generated issue context with our x402 payment protocol. Pay only for what you use."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Step
            number={1}
            title="Create Bounty"
            description="Fund a GitHub issue with USDC. Your funds are held securely in the smart contract."
          />
          <Step
            number={2}
            title="Contribute"
            description="Developers submit PRs that reference the issue. Work on real problems, earn real rewards."
          />
          <Step
            number={3}
            title="Get Paid"
            description="When your PR is merged, Chainlink oracles verify it and automatically release payment."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Fund Your First Bounty?
          </h2>
          <p className="text-blue-100 mb-8">
            Join the decentralized future of open source development
          </p>
          {!isConnected && <ConnectButton />}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600 dark:text-gray-400">
          <p>Built with Chainlink Functions, Viem, and Next.js</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}

function Step({ number, title, description }: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center 
                    justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}