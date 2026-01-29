// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// --Imports--
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// -- Interface --
interface IOracle {
    function verifyContribution(
        bytes32 bountyID,
        address claimer,
        string[] calldata args,
        uint8 slotId,
        uint64 version
    ) external returns (bytes32 requestId);
}

abstract contract CustomReentrancyGuard {
    bool private locked;

    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");

        locked = true;
        _;
        locked = false;
    }
}

contract BountyRegistry is Ownable, CustomReentrancyGuard {
    using SafeERC20 for IERC20;

    // -- State Variable --
    IOracle public oracle;

    // Tracking the bounty status
    enum BountyStatus {
        OPEN,
        VERIFYING,
        PAID,
        REFUNDED
    }

    // Special struct that each bounty must have and easy to track
    struct Bounty {
        address issuer;
        address token;
        uint256 amount;
        BountyStatus status;
        uint256 creationTime;
        string prClaimer;
        bytes32 activeRequestID;
    }

    // Minimum time for refund
    uint256 REFUND_TIMELOCK = 180 days;

    // Secrets
    uint8 public secretsSlotID;
    uint64 public secretsVersion;

    // mapping uinque bounty ids to their respective bounty structs
    mapping(bytes32 => Bounty) public bounties;

    // -- Events --
    event BountyCreated(
        bytes32 indexed bountyID,
        string repoOwner,
        string repoName,
        string issueNumber,
        address indexed issuer,
        address token,
        uint256 amount
    );
    event ClaimSubmitted(
        bytes32 indexed bountyID,
        address indexed claimer,
        bytes32 indexed requestID,
        string prNumber
    );
    event BountyStatusChanged(bytes32 indexed bountyID, BountyStatus newStatus);
    event BountyPaid(
        bytes32 indexed bountyID,
        address indexed claimer,
        uint256 amount,
        string githubUsername
    );
    event FundsRefunded(
        bytes32 indexed bountyID,
        address indexed issuer,
        uint256 amount
    );

    // --Errors--
    error Unauthorised();
    error InvalidAmount();
    error BountyExists();
    error InvalidStatus();
    error TimelockNotExpired();

    // --Constructor--
    constructor(address _oracle) Ownable(msg.sender) {
        oracle = IOracle(_oracle);
    }

    // --Functions--
    /**
     * @notice Creates a bounty for a GitHub issue
     * @param _token ERC20 token address (e.g., USDC, DAI)
     * @param _amount Amount to deposit
     * @param repoOwner GitHub repo and issue details
     */
    function fundIssue(
        uint256 _amount,
        address _token,
        string memory repoOwner,
        string memory repoName,
        string memory issueNumber
    ) external nonReentrant {
        // Checks that the issuer isn't broke
        if (_token == address(0)) revert InvalidAmount();
        if (_amount == 0) revert InvalidAmount();

        // Compute bountyID
        bytes32 bountyID = computeBountyID(repoOwner, repoName, issueNumber);
        // Checks if their is an existing bounty
        if (bounties[bountyID].amount != 0) revert BountyExists();

        // Adds the newly created bounty
        bounties[bountyID] = Bounty({
            issuer: msg.sender,
            token: _token,
            amount: _amount,
            status: BountyStatus.OPEN,
            creationTime: block.timestamp,
            prClaimer: "",
            activeRequestID: bytes32(0)
        });

        // Transfers the bounty amount to this account
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit BountyCreated(
            bountyID,
            repoOwner,
            repoName,
            issueNumber,
            msg.sender,
            _token,
            _amount
        );
    }

    /**
     * @notice Contributor claims a bounty by submitting their PR for verification
     * @param bountyID The bounty being claimed
     * @param prNumber The Pull Request number as a string
     * @param repoOwner GitHub owner details (must match bounty)
     */
    function claimBounty(
        bytes32 bountyID,
        string memory prNumber,
        string memory repoOwner,
        string memory repoName,
        string memory issueNumber
    ) external nonReentrant {
        // Ease of reading create new var bounty which contains the details corresponding bountyID
        Bounty storage bounty = bounties[bountyID];

        // Validation of bounty status and amount
        if (bounty.amount == 0) revert InvalidStatus();
        if (bounty.status != BountyStatus.OPEN) revert InvalidStatus();

        // Change the status of the current bounty
        bounty.status = BountyStatus.VERIFYING;
        emit BountyStatusChanged(bountyID, BountyStatus.VERIFYING);

        // create a new list to pass for verifyContribution
        string[] memory args = new string[](4);
        args[0] = repoOwner;
        args[1] = repoName;
        args[2] = prNumber;
        args[3] = issueNumber;

        // Creating request for oracle funciton call
        bytes32 requestID = oracle.verifyContribution(
            bountyID,
            msg.sender,
            args,
            secretsSlotID,
            secretsVersion
        );
        bounty.activeRequestID = requestID;

        // Let the world know a claim has been made
        emit ClaimSubmitted(bountyID, msg.sender, requestID, prNumber);
    }

    /**
     * @notice Called by Oracle after verification completes
     * @dev Only callable by the trusted Oracle contract
     * @param bountyID The bounty that was verified
     * @param githubUsername Verified GitHub username
     * @param receiver Address to receive funds
     */
    function completeBountyPayout(
        bytes32 bountyID,
        string calldata githubUsername,
        address receiver
    ) external nonReentrant {
        // FIX: Use storage reference instead of memory
        Bounty storage bounty = bounties[bountyID];

        // Checking authorisation and status of the bounty
        if (msg.sender != address(oracle)) revert Unauthorised();
        if (bounty.status != BountyStatus.VERIFYING) revert InvalidStatus();

        // Changing state of the existing bounty
        bounty.status = BountyStatus.PAID;
        bounty.prClaimer = githubUsername;
        emit BountyStatusChanged(bountyID, BountyStatus.PAID);

        // Transfering the bounty to claimer
        IERC20(bounty.token).safeTransfer(receiver, bounty.amount);

        // Bounty payment finally complete
        emit BountyPaid(bountyID, receiver, bounty.amount, githubUsername);
    }

    /**
     * @notice Called by Oracle when verification fails
     * @dev Only callable by the trusted Oracle contract
     * @param bountyID The bounty that failed verification
     */
    function rejectBountyClaim(bytes32 bountyID) external nonReentrant {
        // Only allow calls from Oracle
        if (msg.sender != address(oracle)) revert Unauthorised();

        Bounty storage bounty = bounties[bountyID];

        // Ensure bounty is in VERIFYING state
        if (bounty.status != BountyStatus.VERIFYING) revert InvalidStatus();

        // Revert to OPEN so another claim can be submitted
        bounty.status = BountyStatus.OPEN;
        bounty.activeRequestID = bytes32(0);
        emit BountyStatusChanged(bountyID, BountyStatus.OPEN);
    }

    /**
     * @notice Issuer reclaims funds if bounty remains unclaimed after 6 months
     * @param bountyID The bounty to refund
     */
    function seepFunds(bytes32 bountyID) external nonReentrant {
        // FIX: Use storage reference instead of memory
        Bounty storage bounty = bounties[bountyID];

        // FIX: Check authorization first, then status, then timelock
        if (msg.sender != bounty.issuer) revert Unauthorised();
        if (bounty.status != BountyStatus.OPEN) revert InvalidStatus();
        // FIX: Compare block.timestamp instead of creationTime with itself
        if (block.timestamp <= bounty.creationTime + REFUND_TIMELOCK)
            revert TimelockNotExpired();

        // Changing status of the bounty
        bounty.status = BountyStatus.REFUNDED;
        emit BountyStatusChanged(bountyID, BountyStatus.REFUNDED);

        // Tranferring funds(refunding) from this contract to issuer
        IERC20(bounty.token).safeTransfer(bounty.issuer, bounty.amount);
        emit FundsRefunded(bountyID, bounty.issuer, bounty.amount);
    }

    // --Admin Function--

    /**
     * @notice Updates DON hosted secrets configuration
     * @dev Call after running uploadSecrets.js
     */
    function updateDONSecrets(uint8 slotID, uint64 version) external onlyOwner {
        // update the don secrets
        secretsSlotID = slotID;
        secretsVersion = version;
    }

    // Update oracle
    function updateOracle(address newOracle) external onlyOwner {
        oracle = IOracle(newOracle);
    }

    // -- Helper/View Functions --

    // Hashes certain parameters(repo owner, name, issue id) to create a unique bounty id
    function computeBountyID(
        string memory _repoOwner,
        string memory _repoName,
        string memory _issueNumber
    ) public pure returns (bytes32) {
        bytes32 bountyID = keccak256(
            abi.encodePacked(_repoOwner, _repoName, _issueNumber)
        );
        return bountyID;
    }

    // Getting bounty details
    function getBountyDetails(
        bytes32 bountyID
    )
        external
        view
        returns (
            address issuer,
            address token,
            uint256 amount,
            BountyStatus status,
            uint256 creationTime,
            string memory prClaimer,
            bytes32 activeRequestId
        )
    {
        Bounty storage bounty = bounties[bountyID];
        return (
            bounty.issuer,
            bounty.token,
            bounty.amount,
            bounty.status,
            bounty.creationTime,
            bounty.prClaimer,
            bounty.activeRequestID
        );
    }
}
