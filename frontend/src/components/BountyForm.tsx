'use client';

import { useState } from 'react';
import { useBounty } from '@/hooks/useBounty';
import { useGitHub } from '@/hooks/useGithub';
import { AlertCircle, CheckCircle, Loader2, Search } from 'lucide-react';

export function BountyForm({ onSuccess }: { onSuccess?: () => void }) {
  const [githubUrl, setGithubUrl] = useState('');
  const [amount, setAmount] = useState('');
  const [parsedData, setParsedData] = useState<{
    owner: string;
    repo: string;
    issueNumber: string;
  } | null>(null);
  const [step, setStep] = useState<'input' | 'confirm' | 'creating'>('input');
  
  const { createBounty, isLoading } = useBounty();
  const { parseGitHubUrl, getIssue } = useGitHub();

  const handleParse = async () => {
    const parsed = parseGitHubUrl(githubUrl);
    
    if (!parsed) {
      alert('Invalid GitHub URL. Please use format: https://github.com/owner/repo/issues/123');
      return;
    }

    // Verify issue exists
    const issue = await getIssue(parsed.owner, parsed.repo, parsed.issueNumber);
    
    if (!issue) {
      alert('Could not find this issue on GitHub');
      return;
    }

    setParsedData(parsed);
    setStep('confirm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!parsedData) return;
    
    setStep('creating');

    try {
      await createBounty(
        parsedData.owner,
        parsedData.repo,
        parsedData.issueNumber,
        amount
      );
      
      alert('Bounty created successfully!');
      onSuccess?.();
      
      // Reset form
      setGithubUrl('');
      setAmount('');
      setParsedData(null);
      setStep('input');
    } catch (error: any) {
      alert(`Failed to create bounty: ${error.message}`);
      setStep('confirm');
    }
  };

  if (step === 'input') {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Create Bounty
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              GitHub Issue URL
            </label>
            <input
              type="text"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/issues/123"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Paste the full URL of the GitHub issue you want to fund
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bounty Amount (USDC)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                min="1"
                step="0.01"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Amount in USDC that will be paid to the contributor
            </p>
          </div>

          <button
            onClick={handleParse}
            disabled={!githubUrl || !amount}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 
                     rounded-lg font-medium transition-colors"
          >
            <Search className="w-5 h-5" />
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (step === 'confirm' && parsedData) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Confirm Bounty
        </h2>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">Review your bounty details</p>
              <p>You'll be asked to approve USDC spending and then create the bounty.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Repository</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                {parsedData.owner}/{parsedData.repo}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-400">Issue</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                #{parsedData.issueNumber}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Amount</span>
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                ${amount} USDC
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setStep('input')}
            className="flex-1 border border-gray-300 dark:border-gray-700 px-6 py-3 
                     rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 
                     transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Create Bounty
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
}