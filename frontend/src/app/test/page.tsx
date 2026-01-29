'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { publicClient } from '@/lib/viem/client';
import { CONTRACTS } from '@/lib/contracts/addresses';
import { USDC_ABI, BountyRegistryABI } from '@/lib/contracts/abis';
import { formatUnits } from 'viem';
import { ConnectButton } from '@/components/ConnectButton';

export default function TestPage() {
  const { address, isConnected } = useWallet();
  const [results, setResults] = useState<any>({});
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    if (!address) {
      alert('Please connect wallet first');
      return;
    }

    setTesting(true);
    const tests: any = {};

    try {
      // Test 1: Check network
      const chainId = await publicClient.getChainId();
      tests.chainId = chainId;
      tests.isSepoliaNetwork = chainId === 11155111;

      // Test 2: Check ETH balance
      const ethBalance = await publicClient.getBalance({ address });
      tests.ethBalance = formatUnits(ethBalance, 18);
      tests.hasETH = ethBalance > 0n;

      // Test 3: Check if BountyRegistry exists
      try {
        const registryCode = await publicClient.getBytecode({
          address: CONTRACTS.sepolia.BountyRegistry
        });
        tests.bountyRegistryExists = !!registryCode && registryCode !== '0x';
        tests.bountyRegistryAddress = CONTRACTS.sepolia.BountyRegistry;
      } catch (e: any) {
        tests.bountyRegistryExists = false;
        tests.bountyRegistryError = e.message;
      }

      // Test 4: Check if USDC exists
      try {
        const usdcCode = await publicClient.getBytecode({
          address: CONTRACTS.sepolia.USDC
        });
        tests.usdcExists = !!usdcCode && usdcCode !== '0x';
      } catch (e: any) {
        tests.usdcExists = false;
        tests.usdcError = e.message;
      }

      // Test 5: Check USDC balance
      if (tests.usdcExists) {
        try {
          const balance = await publicClient.readContract({
            address: CONTRACTS.sepolia.USDC,
            abi: USDC_ABI,
            functionName: 'balanceOf',
            args: [address]
          });
          tests.usdcBalance = formatUnits(balance, 6);
          tests.hasUSDC = balance > 0n;
        } catch (e: any) {
          tests.usdcBalanceError = e.message;
        }
      }

      // Test 6: Check USDC decimals
      if (tests.usdcExists) {
        try {
          const decimals = await publicClient.readContract({
            address: CONTRACTS.sepolia.USDC,
            abi: USDC_ABI,
            functionName: 'decimals'
          });
          tests.usdcDecimals = decimals;
        } catch (e: any) {
          tests.usdcDecimalsError = e.message;
        }
      }

      // Test 7: Check if BountyRegistry can be called
      if (tests.bountyRegistryExists) {
        try {
          const slotId = await publicClient.readContract({
            address: CONTRACTS.sepolia.BountyRegistry,
            abi: BountyRegistryABI,
            functionName: 'secretsSlotID'
          });
          tests.bountyRegistryCallable = true;
          tests.secretsSlotID = slotId;
        } catch (e: any) {
          tests.bountyRegistryCallable = false;
          tests.bountyRegistryCallError = e.message;
        }
      }

      setResults(tests);
    } catch (error: any) {
      tests.overallError = error.message;
      setResults(tests);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      runTests();
    }
  }, [isConnected, address]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            MergeMint Diagnostics
          </h1>
          <ConnectButton />
        </div>

        {!isConnected && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
            <p className="text-yellow-800 dark:text-yellow-300">
              Please connect your wallet to run diagnostics
            </p>
          </div>
        )}

        {isConnected && (
          <>
            <button
              onClick={runTests}
              disabled={testing}
              className="mb-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium"
            >
              {testing ? 'Running Tests...' : 'Run Tests Again'}
            </button>

            <div className="space-y-4">
              {/* Network Status */}
              <StatusCard
                title="Network"
                items={[
                  { label: 'Chain ID', value: results.chainId, status: results.isSepoliaNetwork ? 'success' : 'error' },
                  { label: 'Is Sepolia', value: results.isSepoliaNetwork ? 'Yes' : 'No', status: results.isSepoliaNetwork ? 'success' : 'error' }
                ]}
              />

              {/* Wallet Balances */}
              <StatusCard
                title="Wallet Balances"
                items={[
                  { label: 'ETH Balance', value: results.ethBalance, status: results.hasETH ? 'success' : 'error' },
                  { label: 'USDC Balance', value: results.usdcBalance, status: results.hasUSDC ? 'success' : 'error' }
                ]}
              />

              {/* Contracts */}
              <StatusCard
                title="Smart Contracts"
                items={[
                  { label: 'BountyRegistry Exists', value: results.bountyRegistryExists ? 'Yes' : 'No', status: results.bountyRegistryExists ? 'success' : 'error' },
                  { label: 'BountyRegistry Address', value: results.bountyRegistryAddress, status: 'info' },
                  { label: 'BountyRegistry Callable', value: results.bountyRegistryCallable ? 'Yes' : 'No', status: results.bountyRegistryCallable ? 'success' : 'error' },
                  { label: 'USDC Exists', value: results.usdcExists ? 'Yes' : 'No', status: results.usdcExists ? 'success' : 'error' },
                ]}
              />

              {/* Raw Output */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                  Raw Test Results
                </h2>
                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto text-xs">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>

              {/* Action Items */}
              {Object.keys(results).length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">
                    Action Items:
                  </h3>
                  <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                    {!results.isSepoliaNetwork && (
                      <li>• Switch MetaMask to Sepolia network</li>
                    )}
                    {!results.hasETH && (
                      <li>• Get Sepolia ETH from <a href="https://sepoliafaucet.com" target="_blank" className="underline">faucet</a></li>
                    )}
                    {!results.hasUSDC && (
                      <li>• Get test USDC from <a href="https://staging.aave.com/faucet/" target="_blank" className="underline">Aave faucet</a></li>
                    )}
                    {!results.bountyRegistryExists && (
                      <li>• Deploy BountyRegistry contract to Sepolia</li>
                    )}
                    {results.bountyRegistryExists && !results.bountyRegistryCallable && (
                      <li>• BountyRegistry contract may have issues - check deployment</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusCard({ title, items }: { title: string; items: Array<{ label: string; value: any; status?: 'success' | 'error' | 'info' }> }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{title}</h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 dark:text-white">
                {typeof item.value === 'string' && item.value.length > 50 
                  ? `${item.value.slice(0, 10)}...${item.value.slice(-8)}`
                  : String(item.value ?? 'N/A')}
              </span>
              {item.status === 'success' && <span className="text-green-600">✓</span>}
              {item.status === 'error' && <span className="text-red-600">✗</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}