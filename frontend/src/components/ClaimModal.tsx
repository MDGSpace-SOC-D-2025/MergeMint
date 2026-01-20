'use client';

import { useState } from 'react';
import { useBounty } from '@/hooks/useBounty';
import { useGitHub } from '@/hooks/useGithub';
import { useWallet } from '@/contexts/WalletContext';
import { 
  X, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Info
} from 'lucide-react';
import type { Bounty } from '@/types';

interface ClaimModalProps {
  bounty: Bounty;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimModal({ bounty, isOpen, onClose, onSuccess }: ClaimModalProps) {
  const { isConnected } = useWallet();
  const { claimBounty, isLoading } = useBounty();
  const { validatePR } = useGitHub();

  const [prNumber, setPrNumber] = useState('');
  const [validating, setValidating] = useState(false);
  const [prStatus, setPrStatus] = useState<{
    valid: boolean;
    merged: boolean;
    author: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleValidatePR = async () => {
    if (!prNumber) return;

    setValidating(true);
    try {
      const status = await validatePR(bounty.repoOwner, bounty.repoName, prNumber);
      setPrStatus(status);
    } catch (error) {
      console.error('Error validating PR:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async () => {
    if (!prNumber) {
      alert('Please enter a PR number');
      return;
    }

    try {
      await claimBounty(
        bounty.repoOwner,
        bounty.repoName,
        bounty.issueNumber,
        prNumber
      );
      
      alert('Claim submitted! The Chainlink oracle will verify your PR.');
      onSuccess?.();
      onClose();
      setPrNumber('');
      setPrStatus(null);
    } catch (error: any) {
      let message = 'Failed to submit claim';
      
      if (error.message?.includes('user rejected')) {
        message = 'Transaction was rejected';
      } else if (error.message?.includes('insufficient funds')) {
        message = 'Insufficient ETH for gas fees';
      } else if (error.message) {
        message = error.message;
      }
      
      alert(message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Claim Bounty
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Bounty Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Requirements to claim:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your PR must be merged</li>
                  <li>PR description must include "Closes #{bounty.issueNumber}" or "Fixes #{bounty.issueNumber}"</li>
                  <li>Chainlink oracle will verify automatically</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Repository Info */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Repository</p>
            <p className="font-mono text-gray-900 dark:text-white">
              {bounty.repoOwner}/{bounty.repoName}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Issue</p>
            <p className="font-mono text-gray-900 dark:text-white">
              #{bounty.issueNumber}
            </p>
          </div>

          {/* PR Number Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pull Request Number
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={prNumber}
                onChange={(e) => {
                  setPrNumber(e.target.value);
                  setPrStatus(null); // Reset validation
                }}
                placeholder="Enter PR number (e.g., 42)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleValidatePR}
                disabled={!prNumber || validating}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                         hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {validating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Check'
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Find your PR number in the GitHub URL: github.com/{bounty.repoOwner}/{bounty.repoName}/pull/<strong>NUMBER</strong>
            </p>
          </div>

          {/* PR Validation Status */}
          {prStatus && (
            <div className={`border rounded-lg p-4 ${
              prStatus.valid && prStatus.merged
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-start gap-3">
                {prStatus.valid && prStatus.merged ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    prStatus.valid && prStatus.merged
                      ? 'text-green-800 dark:text-green-300'
                      : 'text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {prStatus.valid && prStatus.merged
                      ? '✓ PR is merged and valid'
                      : prStatus.valid && !prStatus.merged
                      ? '⚠ PR exists but is not merged yet'
                      : '✗ PR not found'
                    }
                  </p>
                  {prStatus.author && (
                    <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                      Author: @{prStatus.author}
                    </p>
                  )}
                  <a
                    href={`https://github.com/${bounty.repoOwner}/${bounty.repoName}/pull/${prNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm mt-2 text-blue-600 hover:text-blue-700"
                  >
                    View PR on GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Warning for non-merged PRs */}
          {prStatus && !prStatus.merged && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Note:</strong> You can submit the claim now, but the oracle verification will only succeed after the PR is merged.
              </p>
            </div>
          )}

          {/* Not Connected Warning */}
          {!isConnected && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300">
                Please connect your wallet to claim this bounty.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 dark:border-gray-700 px-4 py-3 rounded-lg
                     font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isConnected || !prNumber || isLoading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                     disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg 
                     font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Claim'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}