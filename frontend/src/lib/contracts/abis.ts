export const BountyRegistryABI = [
  // Functions
  {
    "inputs": [
      {"internalType": "uint256", "name": "_amount", "type": "uint256"},
      {"internalType": "address", "name": "_token", "type": "address"},
      {"internalType": "string", "name": "repoOwner", "type": "string"},
      {"internalType": "string", "name": "repoName", "type": "string"},
      {"internalType": "string", "name": "issueNumber", "type": "string"}
    ],
    "name": "fundIssue",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"internalType": "string", "name": "prNumber", "type": "string"},
      {"internalType": "string", "name": "repoOwner", "type": "string"},
      {"internalType": "string", "name": "repoName", "type": "string"},
      {"internalType": "string", "name": "issueNumber", "type": "string"}
    ],
    "name": "claimBounty",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "bountyID", "type": "bytes32"}
    ],
    "name": "seepFunds",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"internalType": "string", "name": "githubUsername", "type": "string"},
      {"internalType": "address", "name": "receiver", "type": "address"}
    ],
    "name": "completeBountyPayout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint8", "name": "slotID", "type": "uint8"},
      {"internalType": "uint64", "name": "version", "type": "uint64"}
    ],
    "name": "updateDONSecrets",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "newOracle", "type": "address"}
    ],
    "name": "updateOracle",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "string", "name": "_repoOwner", "type": "string"},
      {"internalType": "string", "name": "_repoName", "type": "string"},
      {"internalType": "string", "name": "_issueNumber", "type": "string"}
    ],
    "name": "computeBountyID",
    "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "bountyID", "type": "bytes32"}],
    "name": "getBountyDetails",
    "outputs": [
      {"internalType": "address", "name": "issuer", "type": "address"},
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "uint8", "name": "status", "type": "uint8"},
      {"internalType": "uint256", "name": "creationTime", "type": "uint256"},
      {"internalType": "string", "name": "prClaimer", "type": "string"},
      {"internalType": "bytes32", "name": "activeRequestId", "type": "bytes32"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "oracle",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "secretsSlotID",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "secretsVersion",
    "outputs": [{"internalType": "uint64", "name": "", "type": "uint64"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"indexed": false, "internalType": "string", "name": "repoOwner", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "repoName", "type": "string"},
      {"indexed": false, "internalType": "string", "name": "issueNumber", "type": "string"},
      {"indexed": true, "internalType": "address", "name": "issuer", "type": "address"},
      {"indexed": false, "internalType": "address", "name": "token", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "BountyCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "claimer", "type": "address"},
      {"indexed": true, "internalType": "bytes32", "name": "requestID", "type": "bytes32"},
      {"indexed": false, "internalType": "string", "name": "prNumber", "type": "string"}
    ],
    "name": "ClaimSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"indexed": false, "internalType": "uint8", "name": "newStatus", "type": "uint8"}
    ],
    "name": "BountyStatusChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "claimer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "string", "name": "githubUsername", "type": "string"}
    ],
    "name": "BountyPaid",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "bountyID", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "issuer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "FundsRefunded",
    "type": "event"
  }
] as const;

export const USDC_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "from", "type": "address"},
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;