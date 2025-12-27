// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// -- Imports --

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

contract Oracle is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;

    // -- State variables --
    address public router;
    bytes32 public donId;
    uint64 public subscriptionId;
    uint32 public gasLimit = 300000;
    string public sourceCode; // JavaScript source code for verification
    mapping(bytes32 => bool) public activeRequests; // Mapping to keep track of active requests

    // --Events--
    // 1. Event to track Verificaiton of requests
    event VerificationResult(bytes32 indexed requestId, bool success, string author);

    // --Errors--
    error UnexpectedRequestID(bytes32 requestId);   

    // --Constructor--
    constructor(address _router, bytes32 _donId, uint64 _subId, string memory _source) FunctionsClient(_router) {
        router = _router;
        donId = _donId;
        subscriptionId = _subId;
        sourceCode = _source;
    }

    // --Functions--
    // 1. Verifies the contribution claim made by contributor
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
        
        // Initialize the request object with the stored JavaScript source code.
        req.initializeRequestForInlineJavaScript(sourceCode);
        
        
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

        // Set the requestID to active
        activeRequests[requestId] = true;
        return requestId;
    }

    // 2. Function to execute the result of the verification.js file
    /*
     * @notice Callback function called by the Chainlink DON
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {

        // Checks if false requests are not made
        if (!activeRequests[requestId]) {
            revert UnexpectedRequestID(requestId);
        }

        // Renders the requesID inactive meaning it has been executed on DON
        activeRequests[requestId] = false;

        // Simple error handling if the verification results in the error (not referencing to claim errors)
        if (err.length > 0) {
            // Handle error (e.g. emit event or retry logic)
            emit VerificationResult(requestId, false, "ERROR_IN_SCRIPT");
            return;
        }

        // DECODE: This is the gas efficient part where we decode response into solidity readable bytes
        (bool verified, string memory author) = abi.decode(response, (bool, string));

        // Tracks the result of request made by contributor (irrespective of true/false)
        emit VerificationResult(requestId, verified, author);
    }
}