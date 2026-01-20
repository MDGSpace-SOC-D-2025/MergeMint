'use client';

import { formatUnits } from 'viem';
import { ExternalLink, Clock, DollarSign, GitPullRequest } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Bounty, BountyStatus } from '@/types';

interface BountyCardProps {
  bounty: Bounty;
  issue?: {
    title: string;
    html_url: string;
  };
  onClaim?: () => void;
}

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

function getStatusColor(status: BountyStatus): string {
  return statusColors[status];
}

function getStatusLabel(status: BountyStatus): string {
  return statusLabels[status];
}

export function BountyCard({ bounty, issue, onClaim }: BountyCardProps) {
  const amount = formatUnits(bounty.amount, 6); // USDC has 6 decimals
  const createdAgo = formatDistanceToNow(new Date(Number(bounty.creationTime) * 1000), {
    addSuffix: true
  });

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {issue?.title || `Issue #${bounty.issueNumber}`}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-mono">
              {bounty.repoOwner}/{bounty.repoName}
            </span>
            <span>•</span>
            <span>#{bounty.issueNumber}</span>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(bounty.status)}`}
        >
          {getStatusLabel(bounty.status)}
        </span>
      </div>

      {/* Amount */}
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-green-600" />
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          ${amount}
        </span>
        <span className="text-sm text-gray-500">USDC</span>
      </div>

      {/* Metadata */}
      <div className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <span>Created {createdAgo}</span>
        </div>

        {bounty.status === 2 && bounty.prClaimer && (
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-4 h-4" />
            <span>Claimed by @{bounty.prClaimer}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {issue?.html_url && (
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 border border-gray-300 
                     dark:border-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 
                     dark:hover:bg-gray-800 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            View Issue
          </a>
        )}

        {bounty.status === 0 && onClaim && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onClaim();
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 
                     rounded-lg font-medium transition-colors text-sm"
          >
            Claim Now
          </button>
        )}
      </div>
    </div>
  );
}