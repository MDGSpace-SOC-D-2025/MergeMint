# MergeMint

MergeMint is a decentralized bounty platform that empowers open-source development by allowing users to fund GitHub issues with cryptocurrency. Contributors are automatically rewarded when their Pull Requests are successfully merged, verified through a secure decentralized oracle network.

## Features

- **Crypto-Funded Bounties**: Users can deposit ERC20 tokens (only USDC) to create bounties for any GitHub issue.
- **Decentralized Verification**: Leverages Chainlink Oracles to securely verify off-chain GitHub events (PR merges) directly on-chain.
- **Automated Payouts**: Smart contracts ensure funds are released to the contributor immediately upon verification.
- **Timelock Refunds**: Issuers can reclaim their funds if a bounty remains unclaimed for 180 days, ensuring capital efficiency.
- **Pagination**: Only loads the previous 100,000 blocks on sepolia for bounties.
- **Custom Re-entrancy Gaurd**: Use of custom non-reentrant function for safety. 



## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (React 19)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Web3 Integration**: [Wagmi](https://wagmi.sh/), [Viem](https://viem.sh/), [Ethers.js](https://docs.ethers.org/)
- **State Management**: React Query

### Smart Contracts (Backend)
- **Language**: Solidity (^0.8.20)
- **Framework**: [Foundry](https://book.getfoundry.sh/)
- **Libraries**: OpenZeppelin (ERC20, ReentrancyGuard, Ownable)
- **Oracles**: Chainlink Functions


## Project Structure

```
MergeMint/
├── frontend/                     # Next.js Application
│   ├── src/
│   │   ├── app/                  # Next.js App Router (Pages)
│   │   │   ├── bounties/         # Bounty listing & creation pages
│   │   │   └── ...
│   │   ├── components/           # UI Components (Forms, Modals, Cards)
│   │   ├── contexts/             # Global State (Wallet, etc.)
│   │   ├── hooks/                # Custom React Hooks (useBounty, useGithub)
│   │   ├── lib/                  # Utilities & Contract Configs
│   │   └── types/                # TypeScript Definitions
│   └── ...
├── Backend/
│   ├── Contracts/                # Smart Contracts Environment (Foundry)
│   │   ├── src/                  # Solidity Source Code (BountyRegistry.sol)
│   │   ├── script/               # Deployment & Interaction Scripts
│   │   ├── oracle/               # Chainlink Functions Scripts (JS)
├── └── ...
```

## Installation

### Prerequisites
- Node.js (v18+)
- Foundry (for smart contracts)
- Git

### 1. Frontend Setup
```bash
cd frontend
npm install

### 2. Smart Contracts Setup
```bash
cd Backend/Contracts
forge install
forge build
forge test
```


## Configuration

### Environment Variables

Create `.env` files in the respective directories based on the provided examples or templates.

**Frontend (`frontend/.env.local`)**
```
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
NEXT_PUBLIC_ALCHEMY_ID=...
```

**Contracts (`Backend/Contracts/.env`)**
```
PRIVATE_KEY=...
RPC_URL=...
ETHERSCAN_API_KEY=...
```


## Usage

1.  **Connect Wallet**: Connect your Web3 wallet (e.g., MetaMask) to the frontend.
2.  **Create Bounty**: Paste a GitHub issue URL and specify the amount of USDC to fund.
3.  **Contribute**: Developers solve the issue and submit a Pull Request.
4.  **Claim**: Once the PR is merged, the contributor claims the bounty via the UI.
5.  **Verify & Pay**: The system verifies the merge via Chainlink and automatically transfers the funds.



## Screenshots

![Dashboard](./screenshots/Screenshot%20from%202026-01-29%2021-20-38.png)
![Create Bounty](./screenshots/Screenshot%20from%202026-01-29%2021-20-47.png)
![Bounty Details](./screenshots/Screenshot%20from%202026-01-29%2021-20-54.png)
![Wallet Connection](./screenshots/Screenshot%20from%202026-01-29%2021-21-08.png)
![Transaction Confirmation](./screenshots/Screenshot%20from%202026-01-29%2021-21-15.png)

## Known Issues

-  It currently doesn't verify that the wallet owner is the same person as the GitHub PR author. Making it a first to claim race for gaining bounty rewards.
- Oracle verification requires the `secretsSlotID` and `secretsVersion` to be actively maintained(once every 72 hours).

## Roadmap

- **Week 1**: Created `verification.js` file to verify GitHub merge status without blockchain state. Developed `simulate.js` that inputs a PR URL and outputs a verified true/false signal.
- **Week 2**: Developed `BountyRegistry.sol`. Learnt about the oracle integration required for verification of submitted claim.
- **Week 3**: Created `oracle.sol` and tried to understand and implement x402. Started learning Next.js for frontend implementation.
- **Week 4**: Created frontend and configured it to backend.
- **Week 5**: Final changes and bug fixes with some frontend optimization.

## Future Work

- [ ] Multi-token support beyond USDC.
- [ ] Case check for github usernames.
- [ ] Search feature for bounty creation.
- [ ] Addition of a dashboard component.


