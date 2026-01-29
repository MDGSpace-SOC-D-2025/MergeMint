'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@/components/ConnectButton';
import { BountyCard } from '@/components/BountyCard';
import { publicClient } from '@/lib/viem/client';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { BountyRegistryABI } from '@/lib/contracts/abis';
import { Loader2, GitPullRequest, Filter } from 'lucide-react';
import type { Bounty } from '@/types';

export default function BountiesPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('open');
  const [hasMore, setHasMore] = useState(true);
  const [oldestBlock, setOldestBlock] = useState<bigint | null>(null);
  const [latestBlock, setLatestBlock] = useState<bigint | null>(null);
  const [totalBlocksScanned, setTotalBlocksScanned] = useState<bigint>(0n);

  useEffect(() => {
    loadBounties(true); // true = initial load
  }, []);

  const loadBounties = async (isInitialLoad: boolean = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Get current block number only on initial load
      let currentLatestBlock = latestBlock;
      if (isInitialLoad || !currentLatestBlock) {
        currentLatestBlock = await publicClient.getBlockNumber();
        setLatestBlock(currentLatestBlock);
      }

      // Determine block range (100,000 blocks at a time)
      const BLOCKS_PER_LOAD = 100000n;
      let fromBlock: bigint;
      let toBlock: bigint;

      if (isInitialLoad || !oldestBlock) {
        // First load: get most recent 100,000 blocks
        toBlock = currentLatestBlock;
        fromBlock = currentLatestBlock > BLOCKS_PER_LOAD
          ? currentLatestBlock - BLOCKS_PER_LOAD
          : 0n;
      } else {
        // Load more: get previous 100,000 blocks
        toBlock = oldestBlock - 1n;
        fromBlock = toBlock > BLOCKS_PER_LOAD
          ? toBlock - BLOCKS_PER_LOAD
          : 0n;

        if (fromBlock < 0n) {
          fromBlock = 0n;
        }
      }

      // Check if we've reached genesis block
      if (fromBlock === 0n && !isInitialLoad) {
        setHasMore(false);
      }

      console.log(`Loading bounties from block ${fromBlock} to ${toBlock} (${toBlock - fromBlock} blocks)`);

      // Update total blocks scanned
      const blocksInThisLoad = toBlock - fromBlock;
      setTotalBlocksScanned(prev => prev + blocksInThisLoad);

      // Fetch BountyCreated events
      const logs = await publicClient.getLogs({
        address: CONTRACTS.sepolia.BountyRegistry,
        event: {
          name: 'BountyCreated',
          type: 'event',
          inputs: [
            { type: 'bytes32', name: 'bountyID', indexed: true },
            { type: 'string', name: 'repoOwner' },
            { type: 'string', name: 'repoName' },
            { type: 'string', name: 'issueNumber' },
            { type: 'address', name: 'issuer', indexed: true },
            { type: 'address', name: 'token' },
            { type: 'uint256', name: 'amount' }
          ]
        },
        fromBlock: fromBlock,
        toBlock: toBlock
      });

      console.log(`Found ${logs.length} bounty events`);

      // Fetch full details for each bounty
      const bountyPromises = logs.map(async (log) => {
        const { bountyID, repoOwner, repoName, issueNumber } = log.args as any;

        try {
          const details = await publicClient.readContract({
            address: CONTRACTS.sepolia.BountyRegistry,
            abi: BountyRegistryABI,
            functionName: 'getBountyDetails',
            args: [bountyID]
          });

          const [issuer, token, amount, status, creationTime, prClaimer, activeRequestId] = details;

          return {
            id: bountyID,
            issuer,
            token,
            amount,
            status,
            creationTime,
            prClaimer,
            activeRequestId,
            repoOwner,
            repoName,
            issueNumber
          } as Bounty;
        } catch (error) {
          console.error(`Failed to fetch details for bounty ${bountyID}:`, error);
          return null;
        }
      });

      const loadedBounties = (await Promise.all(bountyPromises)).filter(b => b !== null) as Bounty[];

      if (isInitialLoad) {
        setBounties(loadedBounties);
      } else {
        // Append older bounties (deduplicate by ID)
        // functional update pattern of useState
        setBounties(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const newBounties = loadedBounties.filter(b => !existingIds.has(b.id));
          return [...prev, ...newBounties];
        });
      }

      // Update oldest block tracker
      setOldestBlock(fromBlock);

      // Check if we've reached genesis
      if (fromBlock === 0n) {
        setHasMore(false);
        console.log('Reached genesis block - no more bounties to load');
      }

      console.log(`Total bounties loaded: ${isInitialLoad ? loadedBounties.length : bounties.length + loadedBounties.length}`);

    } catch (error) {
      console.error('Error loading bounties:', error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const filteredBounties = bounties.filter((bounty) => {
    if (filter === 'open') return bounty.status === 0;
    if (filter === 'paid') return bounty.status === 2;
    return true;
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
            <div className="flex items-center gap-4">
              <Link
                href="/bounties/create"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg 
                         font-medium transition-colors"
              >
                Create Bounty
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Browse Bounties
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Find open source issues with crypto rewards
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Refresh Button */}
            <button
              onClick={() => {
                setBounties([]);
                setOldestBlock(null);
                setLatestBlock(null);
                setTotalBlocksScanned(0n);
                setHasMore(true);
                loadBounties(true);
              }}
              disabled={isLoading}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg
                       hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh bounties"
            >
              <svg
                className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg
                         bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Bounties</option>
                <option value="open">Open</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && bounties.length === 0 && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredBounties.length === 0 && (
          <div className="text-center py-20">
            <GitPullRequest className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No bounties found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Be the first to create a bounty!
            </p>
            <Link
              href="/bounties/create"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 
                       rounded-lg font-medium transition-colors"
            >
              Create Bounty
            </Link>
          </div>
        )}

        {/* Bounties Grid */}
        {filteredBounties.length > 0 && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBounties.map((bounty) => (
                <Link
                  key={bounty.id}
                  href={`/bounties/${bounty.repoOwner}/${bounty.repoName}/${bounty.issueNumber}`}
                >
                  <BountyCard bounty={bounty} />
                </Link>
              ))}
            </div>

            {/* Load More Section */}
            <div className="mt-12 text-center">
              {hasMore && (
                <button
                  onClick={() => loadBounties(false)}
                  disabled={isLoadingMore}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white 
                           px-8 py-4 rounded-lg font-medium transition-colors inline-flex 
                           items-center gap-3 shadow-lg hover:shadow-xl"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading older bounties...
                    </>
                  ) : (
                    <>
                      Load More Bounties
                      <span className="text-sm opacity-75">(Previous 100k blocks)</span>
                    </>
                  )}
                </button>
              )}

              {!hasMore && bounties.length > 0 && (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 inline-block">
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                    🎉 All bounties loaded!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    You've reached the beginning of bounty history
                  </p>
                </div>
              )}

              {/* Stats */}
              {bounties.length > 0 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">{filteredBounties.length} bounties displayed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>{bounties.length} total loaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>{totalBlocksScanned.toLocaleString()} blocks scanned</span>
                  </div>
                  {oldestBlock !== null && latestBlock !== null && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="font-mono text-xs">
                        {oldestBlock.toString()} → {latestBlock.toString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}