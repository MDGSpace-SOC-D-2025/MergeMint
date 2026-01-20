export enum BountyStatus {
  OPEN = 0,
  VERIFYING = 1,
  PAID = 2,
  REFUNDED = 3
}

export interface Bounty {
  id: `0x${string}`;
  issuer: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  status: BountyStatus;
  creationTime: bigint;
  prClaimer: string;
  activeRequestId: `0x${string}`;
  // Metadata
  repoOwner: string;
  repoName: string;
  issueNumber: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  created_at: string;
}

export interface PaymentChallenge {
  payment: {
    amount: string;
    currency: string;
    chainId: number;
    recipient: string;
    nonce: number;
    deadline: number;
  };
  eip712: {
    domain: any;
    types: any;
    message: any;
  };
}