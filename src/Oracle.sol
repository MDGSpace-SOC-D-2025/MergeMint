// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract Oracle is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // State variables
    address public router;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 300000;

    // verification.js source code string goes here (or is passed in)
    string public sourceCode; 

    // Event to track payouts/verifications
    event VerificationResult(bytes32 indexed requestId, bool success, string author);

    error UnexpectedRequestID(bytes32 requestId);   

    // Mapping to keep track of active requests
    mapping(bytes32 => bool) public activeRequests;

    constructor(address _router, bytes32 _donId, uint64 _subId, string memory _source) FunctionsClient(_router) {
        router = _router;
        donId = _donId;
        subscriptionId = _subId;
        sourceCode = _source;
    }

    /*
     * Triggers the Oracle to verify a GitHub PR
     * @param owner The GitHub owner (e.g. "vihaan1016")
     * @param repo The GitHub repo (e.g. "MergeMint")
     * @param prNumber The PR number as a string (e.g. "42")
     * @param issueId The Issue ID to verify against (e.g. "101")
     */
    function verifyContribution(
        string[] calldata args, // [owner, repo, prNumber, issueId]
        uint8 donHostedSecretsSlotID, 
        uint64 donHostedSecretsVersion
    ) external returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        
        // This pre-defined function calls the initializerequest function and passes the source code as one of the arguments
        // and the other arguments by itself making our life much easier
        // Initialize request with the JS source code
        req.initializeRequestForInlineJavaScript(sourceCode);
        // this was another way of writing the same thing
        // FunctionsRequest.Request memory req;
        // FunctionsRequest.initializeRequestForInlineJavaScript(req, sourceCode);
        
        // Add the arguments for the JS script
        if (args.length > 0) req.setArgs(args);
        
        // Add secrets (GitHub Token) reference
        if (donHostedSecretsVersion > 0) {
            req.addDONHostedSecrets(donHostedSecretsSlotID, donHostedSecretsVersion);
        }

        // Send request to Chainlink DON
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            gasLimit,
            donId
        );

        activeRequests[requestId] = true;
        return requestId;
    }

    /*
     * @notice Callback function called by the Chainlink DON
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        if (!activeRequests[requestId]) {
            revert UnexpectedRequestID(requestId);
        }
        activeRequests[requestId] = false;

        if (err.length > 0) {
            // Handle error (e.g. emit event or retry logic)
            emit VerificationResult(requestId, false, "ERROR_IN_SCRIPT");
            return;
        }

        // DECODE: This is the gas efficient part
        // We decode the bytes back into Solidity types
        (bool verified, string memory author) = abi.decode(response, (bool, string));

        emit VerificationResult(requestId, verified, author);

        // TODO: Add Logic here to release funds if (verified == true)
        // if (verified) {
        //     payoutBounty(author);
        // }
    }
}