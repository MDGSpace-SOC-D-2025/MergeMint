// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; 
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BountyRegistry
 * @notice The "Vault" that holds crypto assets for Open Source issues.
 */
contract BountyRegistry is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // --- State Variables ---

    // 6 months in seconds (180 days)
    uint256 public constant REFUND_TIMELOCK = 180 days;

    enum BountyStatus { 
        OPEN,       // 0: Deposited, waiting for work
        VERIFYING,  // 1: Contributor claimed, Oracle is checking (Locks funds)
        PAID,       // 2: Work verified, funds sent
        REFUNDED    // 3: Timelock expired, issuer reclaimed funds
    }

    struct Bounty {
        address issuer;       // The maintainer who deposited funds
        address token;        // The ERC20 token address
        uint256 amount;       // Amount deposited
        BountyStatus status;  // Current lifecycle state
        uint256 creationTime; // Used for refund timelocks
        string prAuthor;      // The GitHub username who claimed it
    }

    struct IssueParams {
        string repoOwner;
        string repoName;
        string issueNumber;
    }

    mapping(bytes32 => Bounty) public bounties;

    event BountyCreated(
        bytes32 indexed bountyId,
        string repoOwner,
        string repoName,
        string issueNumber,
        address indexed issuer,
        address token,
        uint256 amount
    );

    event BountyStatusChanged(bytes32 indexed bountyId, BountyStatus newStatus);
    event FundsWithdrawn(bytes32 indexed bountyId, address indexed recipient, uint256 amount);

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Funds a specific GitHub issue.
     * @dev Sets state to OPEN.
     */
    function fundIssue(
        address _token,
        uint256 _amount,
        IssueParams calldata _params
    ) external nonReentrant {
        require(_amount > 0, "Amount must be greater than 0");
        require(_token != address(0), "Invalid token address");

        bytes32 bountyId = computeBountyId(_params.repoOwner, _params.repoName, _params.issueNumber);
        require(bounties[bountyId].amount == 0, "Bounty already exists for this issue");

        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        bounties[bountyId] = Bounty({
            issuer: msg.sender,
            token: _token,
            amount: _amount,
            status: BountyStatus.OPEN,
            creationTime: block.timestamp,
            prAuthor: ""
        });

        emit BountyCreated(
            bountyId, 
            _params.repoOwner, 
            _params.repoName, 
            _params.issueNumber, 
            msg.sender, 
            _token, 
            _amount
        );
    }

    /**
     * @notice Allows the MAINTAINER to reclaim funds if the issue is ignored.
     * @dev Lifecycle: OPEN -> REFUNDED.
     * @param _bountyId The ID of the bounty to refund.
     */
    function sweepFunds(bytes32 _bountyId) external nonReentrant {
        Bounty storage bounty = bounties[_bountyId];

        // 1. Access Control: Only the original funder can refund
        require(msg.sender == bounty.issuer, "Only the issuer can sweep funds");

        // 2. State Check: Can only refund if still OPEN
        require(bounty.status == BountyStatus.OPEN, "Bounty is not OPEN (may be verifying or paid)");

        // 3. Timelock Check: Must wait 6 months
        require(block.timestamp >= bounty.creationTime + REFUND_TIMELOCK, "Timelock not yet expired");

        // 4. Update State (Effects)
        bounty.status = BountyStatus.REFUNDED;
        emit BountyStatusChanged(_bountyId, BountyStatus.REFUNDED);

        // 5. Transfer (Interactions)
        IERC20(bounty.token).safeTransfer(bounty.issuer, bounty.amount);
        
        emit FundsWithdrawn(_bountyId, bounty.issuer, bounty.amount);
    }

    /**
     * @notice Placeholder for Week 3: This will trigger the Chainlink Oracle.
     * @dev Lifecycle: OPEN -> VERIFYING.
     */
    function initiateClaim(bytes32 _bountyId) external {
        Bounty storage bounty = bounties[_bountyId];
        require(bounty.status == BountyStatus.OPEN, "Bounty not available");
        
        // In Week 3, this will call the Oracle.
        // For now, we simulate the state change lock.
        bounty.status = BountyStatus.VERIFYING;
        emit BountyStatusChanged(_bountyId, BountyStatus.VERIFYING);
    }

    function computeBountyId(
        string memory _repoOwner,
        string memory _repoName,
        string memory _issueNumber
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_repoOwner, _repoName, _issueNumber));
    }

    // Admin emergency function (distinct from user sweepFunds)
    function emergencySweep(address _token, uint256 _amount) external onlyOwner {
         IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}