// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// -- Imports --
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

// -- Interface --
interface IBountyRegistry {
    function completeBountyPayout(
        bytes32 bountyId,
        address recipient,
        string calldata githubUsername
    ) external;
}

contract IntegratedOracle is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // --- Configuration ---
    address public router;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 300000;
    string public sourceCode;
    
    // Reference to the Bounty Vault
    IBountyRegistry public bountyRegistry;
    address public owner;

    // --- Request Tracking ---
    struct VerificationRequest {
        bytes32 bountyId;      // Which bounty is being verified
        address claimant;      // Who initiated the claim
        bool active;           // Prevents replay attacks
    }

    mapping(bytes32 => VerificationRequest) public requests;

    // --- Events ---
    event ClaimInitiated(
        bytes32 indexed requestId,
        bytes32 indexed bountyId,
        address indexed claimant,
        string prNumber
    );

    event VerificationComplete(
        bytes32 indexed requestId,
        bytes32 indexed bountyId,
        bool verified,
        string author
    );

    event PayoutTriggered(
        bytes32 indexed bountyId,
        address indexed recipient,
        string githubUsername
    );

    // --- Errors ---
    error UnexpectedRequestID(bytes32 requestId);
    error Unauthorized();
    error InvalidBountyId();

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // -- Constructor -- 
    constructor(
        address _router,
        bytes32 _donId,
        uint64 _subId,
        string memory _source,
        address _bountyRegistry
    ) FunctionsClient(_router) {
        router = _router;
        donId = _donId;
        subscriptionId = _subId;
        sourceCode = _source;
        bountyRegistry = IBountyRegistry(_bountyRegistry); // Letting this contract know bountyregistry exists
        owner = msg.sender;
    }

    // -- Functions --
    /**
     * @notice Initializes claim verification for a bounty
     * @dev Called by BountyRegistry when a contributor claims a bounty
     * @param bountyId The unique identifier for the bounty
     * @param claimant The address claiming the bounty
     * @param args [repoOwner, repoName, prNumber, issueNumber]
     * @param slotId DON hosted secrets slot ID
     * @param version DON hosted secrets version
     */
    function verifyContribution(
        bytes32 bountyId,
        address claimant,
        string[] calldata args,
        uint8 slotId,
        uint64 version
    ) external returns (bytes32 requestId) {
        // Only allow calls from BountyRegistry
        if (msg.sender != address(bountyRegistry)) revert Unauthorized();
        if (bountyId == bytes32(0)) revert InvalidBountyId();

        // Build Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(sourceCode);
        
        if (args.length > 0) req.setArgs(args);
        if (version > 0) req.addDONHostedSecrets(slotId, version);

        // Send to Chainlink DON
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        // Track this request
        requests[requestId] = VerificationRequest({
            bountyId: bountyId,
            claimant: claimant,
            active: true
        });

        emit ClaimInitiated(requestId, bountyId, claimant, args[2]);
        return requestId;
    }

    /**
     * @notice Chainlink DON callback - processes verification results
     * @dev Automatically called by Chainlink when verification completes
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        VerificationRequest storage request = requests[requestId];
        
        if (!request.active) revert UnexpectedRequestID(requestId);
        request.active = false;

        // Handle script errors
        if (err.length > 0) {
            emit VerificationComplete(requestId, request.bountyId, false, "SCRIPT_ERROR");
            // Bounty remains in VERIFYING state
            return;
        }

        // Decode Oracle response: (bool verified, string memory githubUsername)
        (bool verified, string memory author) = abi.decode(response, (bool, string));

        emit VerificationComplete(requestId, request.bountyId, verified, author);

        // If verification passed, trigger payout
        if (verified) {
            bountyRegistry.completeBountyPayout(
                request.bountyId,
                request.claimant,
                author
            );
            
            emit PayoutTriggered(request.bountyId, request.claimant, author);
        }
        // If verification failed, bounty returns to OPEN state (handled in Registry)
    }

    // --- Admin Functions ---

    function updateBountyRegistry(address _newRegistry) external onlyOwner {
        bountyRegistry = IBountyRegistry(_newRegistry);
    }

    function updateSourceCode(string memory _newSource) external onlyOwner {
        sourceCode = _newSource;
    }
}