import { useState } from 'react';
import { parseUnits, encodeFunctionData, keccak256, encodePacked } from 'viem';
import { sepolia } from 'viem/chains';
import { publicClient } from '@/lib/viem/client';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { BountyRegistryABI, USDC_ABI } from '@/lib/contracts/abis';
import type { Bounty, BountyStatus } from '@/types';

export function useBounty() {
  const { address, walletClient } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Computes a unique bounty ID from repo details
   * Uses encodePacked (matching Solidity's abi.encodePacked) instead of encodeAbiParameters
   */
  const computeBountyId = (
    repoOwner: string,
    repoName: string,
    issueNumber: string
  ): `0x${string}` => {
    // Must use encodePacked to match Solidity's abi.encodePacked
    const encoded = encodePacked(
      ['string', 'string', 'string'],
      [repoOwner, repoName, issueNumber]
    );
    return keccak256(encoded);
  };

  /**
   * Fetches bounty details from the contract
   */
  const getBounty = async (
    repoOwner: string,
    repoName: string,
    issueNumber: string
  ): Promise<Bounty | null> => {
    try {
      console.log('getBounty called with:', { repoOwner, repoName, issueNumber });
      
      const bountyId = computeBountyId(repoOwner, repoName, issueNumber);
      console.log('Computed bountyId:', bountyId);

      const result = await publicClient.readContract({
        address: CONTRACTS.sepolia.BountyRegistry,
        abi: BountyRegistryABI,
        functionName: 'getBountyDetails',
        args: [bountyId]
      });

      const [issuer, token, amount, status, creationTime, prClaimer, activeRequestId] = result;
      console.log('Contract returned:', { amount: amount.toString(), status });

      // Return null if bounty doesn't exist
      if (amount === 0n) {
        console.warn('Bounty not found - amount is 0n');
        return null;
      }

      console.log('Bounty found successfully');

      return {
        id: bountyId,
        issuer,
        token,
        amount,
        status: status as BountyStatus,
        creationTime,
        prClaimer,
        activeRequestId,
        repoOwner,
        repoName,
        issueNumber
      };
    } catch (error) {
      console.error('Error fetching bounty:', error);
      return null;
    }
  };

  /**
   * Creates a new bounty
   */
  const createBounty = async (
    repoOwner: string,
    repoName: string,
    issueNumber: string,
    amount: string // In USDC (e.g., "100")
  ) => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const amountWei = parseUnits(amount, 6); // USDC has 6 decimals

      // Step 1: Approve USDC spending
      console.log('Approving USDC...');
      const approveHash = await walletClient.writeContract({
        address: CONTRACTS.sepolia.USDC,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACTS.sepolia.BountyRegistry, amountWei],
        account: address,
        chain: sepolia
      });

      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      console.log('USDC approved');

      // Step 2: Create bounty
      console.log('Creating bounty...');
      const hash = await walletClient.writeContract({
        address: CONTRACTS.sepolia.BountyRegistry,
        abi: BountyRegistryABI,
        functionName: 'fundIssue',
        args: [
          amountWei,
          CONTRACTS.sepolia.USDC,
          repoOwner,
          repoName,
          issueNumber
        ],
        account: address,
        chain: sepolia
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Bounty created:', receipt.transactionHash);

      return receipt;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create bounty';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Claims a bounty by submitting a PR
   */
  const claimBounty = async (
    repoOwner: string,
    repoName: string,
    issueNumber: string,
    prNumber: string
  ) => {
    if (!address || !walletClient) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const bountyId = computeBountyId(repoOwner, repoName, issueNumber);

      const hash = await walletClient.writeContract({
        address: CONTRACTS.sepolia.BountyRegistry,
        abi: BountyRegistryABI,
        functionName: 'claimBounty',
        args: [bountyId, prNumber, repoOwner, repoName, issueNumber],
        account: address,
        chain: sepolia
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Claim submitted:', receipt.transactionHash);

      return receipt;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to claim bounty';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Watches for bounty status changes
   */
  const watchBountyStatus = (
    bountyId: `0x${string}`,
    callback: (newStatus: BountyStatus) => void
  ) => {
    return publicClient.watchContractEvent({
      address: CONTRACTS.sepolia.BountyRegistry,
      abi: BountyRegistryABI,
      eventName: 'BountyStatusChanged',
      args: { bountyID: bountyId },
      onLogs: (logs) => {
        if (logs.length > 0) {
          const newStatus = logs[0].args.newStatus as BountyStatus;
          callback(newStatus);
        }
      }
    });
  };

  /**
   * Checks user's USDC balance
   */
  const getUSDCBalance = async (): Promise<bigint> => {
    if (!address) return 0n;

    try {
      const balance = await publicClient.readContract({
        address: CONTRACTS.sepolia.USDC,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address]
      });
      return balance;
    } catch (error) {
      console.error('Error fetching USDC balance:', error);
      return 0n;
    }
  };

  return {
    computeBountyId,
    getBounty,
    createBounty,
    claimBounty,
    watchBountyStatus,
    getUSDCBalance,
    isLoading,
    error
  };
}