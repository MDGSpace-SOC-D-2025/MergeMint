'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { ConnectButton } from '@/components/ConnectButton';
import { useWallet } from '@/contexts/WalletContext';
import { useBounty } from '@/hooks/useBounty';
import { useIssue } from '@/hooks/useGithub';
// import { usePayment } from '@/hooks/usePayment';
import { ClaimModal } from '@/components/ClaimModal';
import {
  GitPullRequest,
  ArrowLeft,
  ExternalLink,
  Loader2,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { BountyStatus, Bounty } from '@/types';

const statusColors: Record<BountyStatus, string> = {
  [0]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  [1]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  [2]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
  [3]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
};

const statusLabels: Record<BountyStatus, string> = {
  [0]: 'Open',
  [1]: 'Verifying',
  [2]: 'Paid',
  [3]: 'Refunded'
};

function getStatusColor(status: number): string {
  return statusColors[status as BountyStatus] || statusColors[0];
}

function getStatusLabel(status: number): string {
  return statusLabels[status as BountyStatus] || 'Unknown';
}

export default function BountyDetailPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; issue: string }>;
}) {
  const resolvedParams = use(params);
  const { owner, repo, issue } = resolvedParams;

  const { isConnected } = useWallet();
  const { getBounty, claimBounty, watchBountyStatus, computeBountyId, isLoading: bountyLoading } = useBounty();
  const { issue: githubIssue, isLoading: issueLoading } = useIssue(owner, repo, issue);
  // const { fetchPaidContext, isProcessing: paymentLoading } = usePayment();

  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [prNumber, setPrNumber] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [statusNotification, setStatusNotification] = useState<{
    type: 'rejected' | 'paid' | null;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadBounty();
  }, [owner, repo, issue]);

  // Watch for real-time status changes (including rejections)
  useEffect(() => {
    if (!bounty?.id) return;

    const unwatch = watchBountyStatus(bounty.id, (newStatus) => {
      console.log('🔔 Bounty status changed:', newStatus);

      // Check if bounty was rejected (went from VERIFYING back to OPEN)
      if (bounty.status === 1 && newStatus === 0) {
        setStatusNotification({
          type: 'rejected',
          message: 'Claim verification failed. The bounty is now open for new claims.'
        });
      } else if (newStatus === 2) {
        setStatusNotification({
          type: 'paid',
          message: 'Bounty has been paid! Verification successful.'
        });
      }

      // Reload bounty data
      loadBounty();
    });

    return () => unwatch();
  }, [bounty?.id, bounty?.status]);

  const loadBounty = async () => {
    console.log('📄 Detail page loading bounty for:', { owner, repo, issue });
    const bountyData = await getBounty(owner, repo, issue);
    console.log('📊 Detail page received bounty:', bountyData);
    setBounty(bountyData);
  };

  // const handleGetContext = async () => {
  //   try {
  //     const contextData = await fetchPaidContext(owner, repo, issue);
  //     setContext(contextData.context);
  //   } catch (error: any) {
  //     alert(`Failed to get context: ${error.message}`);
  //   }
  // };

  if (bountyLoading || issueLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <Link href="/" className="flex items-center gap-2">
                <GitPullRequest className="w-8 h-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  MergeMint
                </span>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Bounty Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No bounty exists for this issue yet.
          </p>
          <Link
            href="/bounties/create"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 
                     rounded-lg font-medium transition-colors"
          >
            Create Bounty
          </Link>
        </main>
      </div>
    );
  }

  const amount = formatUnits(bounty.amount, 6);
  const createdAgo = formatDistanceToNow(new Date(Number(bounty.creationTime) * 1000), {
    addSuffix: true
  });

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
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/bounties"
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 
                   hover:text-gray-900 dark:hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bounties
        </Link>

        {/* Status Notification Banner */}
        {statusNotification && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center justify-between ${statusNotification.type === 'rejected'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            }`}>
            <div className="flex items-center gap-3">
              {statusNotification.type === 'rejected' ? (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              <p className={`text-sm font-medium ${statusNotification.type === 'rejected'
                  ? 'text-orange-800 dark:text-orange-300'
                  : 'text-green-800 dark:text-green-300'
                }`}>
                {statusNotification.message}
              </p>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {githubIssue?.title || `Issue #${issue}`}
              </h1>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="font-mono">{owner}/{repo}</span>
                <span>•</span>
                <span>#{issue}</span>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(bounty.status)}`}>
              {getStatusLabel(bounty.status)}
            </span>
          </div>

          {/* Bounty Amount */}
          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 
                        rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Bounty Reward</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  ${amount} <span className="text-lg text-gray-500">USDC</span>
                </p>
              </div>
            </div>
          </div>

          {/* Issue Description */}
          {githubIssue?.body && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Description
              </h3>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {githubIssue.body.substring(0, 500)}
                  {githubIssue.body.length > 500 && '...'}
                </p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Created {createdAgo}</span>
            </div>
            {bounty.status === 2 && bounty.prClaimer && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Claimed by @{bounty.prClaimer}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {githubIssue?.html_url && (
              <a
                href={githubIssue.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 border border-gray-300 
                         dark:border-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 
                         dark:hover:bg-gray-800 transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
                View on GitHub
              </a>
            )}

            {bounty.status === 0 && isConnected && (
              <button
                onClick={() => setShowClaimModal(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 
                         rounded-lg font-medium transition-colors"
              >
                Claim Bounty
              </button>
            )}


          </div>

          {/* Context Display */}
          {context && (
            <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 
                          dark:border-purple-800 rounded-lg">
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 mb-2">
                AI-Generated Context
              </h4>
              <pre className="text-sm text-purple-800 dark:text-purple-400 whitespace-pre-wrap">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </main>

      {/* Claim Modal */}
      {bounty && (
        <ClaimModal
          bounty={bounty}
          isOpen={showClaimModal}
          onClose={() => setShowClaimModal(false)}
          onSuccess={loadBounty}
        />
      )}
    </div>
  );
}