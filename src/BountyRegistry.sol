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
    
    // Tracks the status of bounties created
    enum BountyStatus { 
        OPEN,       // 0: Deposited, waiting for work
        VERIFYING,  // 1: Contributor claimed, Oracle is checking (Locks funds)
        PAID,       // 2: Work verified, funds sent
        REFUNDED    // 3: Timelock expired, issuer reclaimed funds
    }

    // Special struct to store vital information of bounties created
    struct Bounty {
        address issuer;       // The maintainer who deposited funds
        address token;        // The ERC20 token address
        uint256 amount;       // Amount deposited
        BountyStatus status;  // Current lifecycle state
        uint256 creationTime; // Used for refund timelocks
        string prAuthor;      // The GitHub username who claimed it
    }

    // Mapping of bountyID to Bounty struct
    mapping(bytes32 => Bounty) public bounties;


    // --- Events ---
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

    // --- Constructor ---
    constructor() Ownable(msg.sender) {}

    /**
     * @notice Funds a specific GitHub issue.
     * @dev Sets state to OPEN.
     */
    function fundIssue (
        address _token,
        uint256 _amount,
        string memory repoOwner,
        string memory repoName,
        string memory issueID
    ) external nonReentrant {
        // Basic requirements for bounty to be created
        require(_token != address(0), "Token must exist!!");
        require(_amount > 0, "Bounty must have value more than 0!!");

        // Creates a unique bountyID for unique issue with given params
        bytes32 bountyID = keccak256(abi.encodePacked(repoOwner, repoName, issueID));
        require(bounties[bountyID].amount == 0, "Bounty for this issue already exists");

        // Maps newly created bountyID to a Bounty struct to keep track
        bounties[bountyID] = Bounty({
            issuer: msg.sender,
            token: _token,
            amount: _amount,
            status: BountyStatus.OPEN,
            creationTime: block.timestamp,
            prAuthor: ""
        });

        // Transfers the amount from the maintainer to this contract.
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // Emits event for the newly funded bounty
        emit BountyCreated(bountyID, repoOwner, repoName, issueID, msg.sender, _token, _amount);
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
        
        // This function will eventually interact with the oracle to change status
        // For now, we simulate the state change lock.
        bounty.status = BountyStatus.VERIFYING;
        emit BountyStatusChanged(_bountyId, BountyStatus.VERIFYING);
    }

    // Admin emergency function (different from user sweepFunds)
    function emergencySweep(address _token, uint256 _amount) external onlyOwner {
         IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}