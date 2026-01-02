// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Oracle.sol";

// Mock BountyRegistry for testing
contract MockBountyRegistry {
    bytes32 public lastPayoutBountyId;
    address public lastPayoutRecipient;
    string public lastPayoutGithubUsername;
    uint256 public payoutCallCount;
    bool public shouldRevert;
    
    function completeBountyPayout(
        bytes32 bountyId,
        string calldata githubUsername,
        address recipient
    ) external {
        require(!shouldRevert, "MockBountyRegistry: Revert requested");
        lastPayoutBountyId = bountyId;
        lastPayoutRecipient = recipient;
        lastPayoutGithubUsername = githubUsername;
        payoutCallCount++;
    }
    
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }
}

// Mock Chainlink Router for testing
contract MockFunctionsRouter {
    bytes32 public lastRequestId;
    bytes public lastRequest;
    uint64 public lastSubscriptionId;
    uint32 public lastGasLimit;
    bytes32 public lastDonId;
    
    // ✅ FIX: Add nonce to ensure unique request IDs
    uint256 private nonce;
    
    function sendRequest(
        uint64 subscriptionId,
        bytes calldata data,
        uint16,
        uint32 gasLimit,
        bytes32 donId
    ) external returns (bytes32) {
        lastSubscriptionId = subscriptionId;
        lastRequest = data;
        lastGasLimit = gasLimit;
        lastDonId = donId;
        
        // ✅ FIX: Include nonce to make each request unique
        bytes32 requestId = keccak256(abi.encodePacked(data, block.timestamp, msg.sender, nonce++));
        lastRequestId = requestId;
        return requestId;
    }
}

contract IntegratedOracleTest is Test {
    IntegratedOracle public oracle;
    MockBountyRegistry public bountyRegistry;
    MockFunctionsRouter public router;
    
    address public owner = address(1);
    address public claimer = address(2);
    address public attacker = address(3);
    
    bytes32 public constant DON_ID = bytes32(uint256(0x123));
    uint64 public constant SUBSCRIPTION_ID = 100;
    string public constant SOURCE_CODE = "console.log('test')";
    
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
    
    function setUp() public {
        vm.startPrank(owner);
        
        router = new MockFunctionsRouter();
        bountyRegistry = new MockBountyRegistry();
        
        oracle = new IntegratedOracle(
            address(router),
            DON_ID,
            SUBSCRIPTION_ID,
            SOURCE_CODE,
            address(bountyRegistry)
        );
        
        vm.stopPrank();
    }
    
    // ============ Constructor Tests ============
    
    function test_Constructor_InitializesCorrectly() public view {
        assertEq(oracle.router(), address(router));
        assertEq(oracle.donId(), DON_ID);
        assertEq(oracle.subscriptionId(), SUBSCRIPTION_ID);
        assertEq(oracle.sourceCode(), SOURCE_CODE);
        assertEq(address(oracle.bountyRegistry()), address(bountyRegistry));
        assertEq(oracle.owner(), owner);
        assertEq(oracle.gasLimit(), 300000);
    }
    
    // ============ verifyContribution Tests ============
    
    function test_VerifyContribution_Success() public {
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        args[0] = "vihaan1016";
        args[1] = "MergeMint";
        args[2] = "42";
        args[3] = "101";
        
        vm.startPrank(address(bountyRegistry));
        
        vm.expectEmit(false, true, true, false);
        emit ClaimInitiated(bytes32(0), bountyId, claimer, "42");
        
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        vm.stopPrank();
        
        // Verify request was stored
        (bytes32 storedBountyId, address storedClaimant, bool active) = oracle.requests(requestId);
        assertEq(storedBountyId, bountyId);
        assertEq(storedClaimant, claimer);
        assertTrue(active);
        
        // Verify Chainlink request was made
        assertEq(router.lastRequestId(), requestId);
        assertEq(router.lastSubscriptionId(), SUBSCRIPTION_ID);
        assertEq(router.lastGasLimit(), 300000);
        assertEq(router.lastDonId(), DON_ID);
    }
    
    function test_VerifyContribution_WithoutSecrets() public {
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        args[0] = "vihaan1016";
        args[1] = "MergeMint";
        args[2] = "42";
        args[3] = "101";
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 0, 0);
        
        assertTrue(requestId != bytes32(0));
    }
    
    function test_VerifyContribution_RevertWhen_NotBountyRegistry() public {
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        
        vm.startPrank(attacker);
        vm.expectRevert(IntegratedOracle.Unauthorized.selector);
        oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        vm.stopPrank();
    }
    
    function test_VerifyContribution_RevertWhen_InvalidBountyId() public {
        string[] memory args = new string[](4);
        
        vm.startPrank(address(bountyRegistry));
        vm.expectRevert(IntegratedOracle.InvalidBountyId.selector);
        oracle.verifyContribution(bytes32(0), claimer, args, 1, 100);
        vm.stopPrank();
    }
    
    // ============ fulfillRequest Tests ============
    
    function test_FulfillRequest_VerificationPassed() public {
        // Setup: Create a verification request
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        args[0] = "vihaan1016";
        args[1] = "MergeMint";
        args[2] = "42";
        args[3] = "101";
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        // Prepare response: (bool verified = true, string author = "bountyHunter69")
        bool verified = true;
        string memory author = "bountyHunter69";
        bytes memory response = abi.encode(verified, author);
        bytes memory err = "";
        
        // Simulate Chainlink callback
        vm.startPrank(address(router));
        
        vm.expectEmit(true, true, false, true);
        emit VerificationComplete(requestId, bountyId, true, "bountyHunter69");
        
        vm.expectEmit(true, true, false, true);
        emit PayoutTriggered(bountyId, claimer, "bountyHunter69");
        
        // Use low-level call to simulate internal fulfillRequest
        (bool success,) = address(oracle).call(
            abi.encodeWithSignature(
                "handleOracleFulfillment(bytes32,bytes,bytes)",
                requestId,
                response,
                err
            )
        );
        
        vm.stopPrank();
        
        // Verify request is no longer active
        (, , bool active) = oracle.requests(requestId);
        assertFalse(active);
        
        // Verify bountyRegistry.completeBountyPayout was called
        assertEq(bountyRegistry.payoutCallCount(), 1);
        assertEq(bountyRegistry.lastPayoutBountyId(), bountyId);
        assertEq(bountyRegistry.lastPayoutRecipient(), claimer);
        assertEq(bountyRegistry.lastPayoutGithubUsername(), "bountyHunter69");
    }
    
    function test_FulfillRequest_VerificationFailed() public {
        // Setup: Create a verification request
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        args[0] = "vihaan1016";
        args[1] = "MergeMint";
        args[2] = "42";
        args[3] = "101";
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        // Prepare response: (bool verified = false, string author = "wrongUser")
        bool verified = false;
        string memory author = "wrongUser";
        bytes memory response = abi.encode(verified, author);
        bytes memory err = "";
        
        // Simulate Chainlink callback
        vm.startPrank(address(router));
        
        vm.expectEmit(true, true, false, true);
        emit VerificationComplete(requestId, bountyId, false, "wrongUser");
        
        oracle.handleOracleFulfillment(requestId, response, err);
        
        vm.stopPrank();
        
        // Verify request is deactivated
        (, , bool active) = oracle.requests(requestId);
        assertFalse(active);
        
        // Verify NO payout was triggered
        assertEq(bountyRegistry.payoutCallCount(), 0);
    }
    
    function test_FulfillRequest_ScriptError() public {
        // Setup: Create a verification request
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        // Prepare error response
        bytes memory response = "";
        bytes memory err = "Script execution failed";
        
        // Simulate Chainlink callback with error
        vm.startPrank(address(router));
        
        vm.expectEmit(true, true, false, true);
        emit VerificationComplete(requestId, bountyId, false, "SCRIPT_ERROR");
        
        oracle.handleOracleFulfillment(requestId, response, err);
        
        vm.stopPrank();
        
        // Verify request is deactivated
        (, , bool active) = oracle.requests(requestId);
        assertFalse(active);
        
        // Verify NO payout
        assertEq(bountyRegistry.payoutCallCount(), 0);
    }
    
    function test_FulfillRequest_RevertWhen_UnexpectedRequestId() public {
        bytes32 fakeRequestId = keccak256(abi.encodePacked("fake"));
        bytes memory response = abi.encode(true, "test");
        bytes memory err = "";
        
        vm.startPrank(address(router));
        
        vm.expectRevert(
            abi.encodeWithSelector(IntegratedOracle.UnexpectedRequestID.selector, fakeRequestId)
        );
        
        oracle.handleOracleFulfillment(fakeRequestId, response, err);
        
        vm.stopPrank();
    }
    
    function test_FulfillRequest_RevertWhen_RequestAlreadyFulfilled() public {
        // Setup and fulfill once
        bytes32 bountyId = keccak256(abi.encodePacked("test", "bounty"));
        string[] memory args = new string[](4);
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        bytes memory response = abi.encode(true, "test");
        bytes memory err = "";
        
        vm.startPrank(address(router));
        
        // First fulfillment
        oracle.handleOracleFulfillment(requestId, response, err);
        
        // Try to fulfill again
        vm.expectRevert(
            abi.encodeWithSelector(IntegratedOracle.UnexpectedRequestID.selector, requestId)
        );
        
        oracle.handleOracleFulfillment(requestId, response, err);
        
        vm.stopPrank();
    }
    
    // ============ Admin Function Tests ============
    
    function test_UpdateBountyRegistry_Success() public {
        address newRegistry = address(0x456);
        
        vm.prank(owner);
        oracle.updateBountyRegistry(newRegistry);
        
        assertEq(address(oracle.bountyRegistry()), newRegistry);
    }
    
    function test_UpdateBountyRegistry_RevertWhen_NotOwner() public {
        address newRegistry = address(0x456);
        
        vm.startPrank(attacker);
        vm.expectRevert(IntegratedOracle.Unauthorized.selector);
        oracle.updateBountyRegistry(newRegistry);
        vm.stopPrank();
    }
    
    function test_UpdateSourceCode_Success() public {
        string memory newSource = "console.log('new code')";
        
        vm.prank(owner);
        oracle.updateSourceCode(newSource);
        
        assertEq(oracle.sourceCode(), newSource);
    }
    
    function test_UpdateSourceCode_RevertWhen_NotOwner() public {
        string memory newSource = "console.log('new code')";
        
        vm.startPrank(attacker);
        vm.expectRevert(IntegratedOracle.Unauthorized.selector);
        oracle.updateSourceCode(newSource);
        vm.stopPrank();
    }
    
    // ============ Integration Tests ============
    
    function test_MultipleVerifications_Sequential() public {
        bytes32 bountyId1 = keccak256(abi.encodePacked("bounty1"));
        bytes32 bountyId2 = keccak256(abi.encodePacked("bounty2"));
        
        string[] memory args = new string[](4);
        args[0] = "owner";
        args[1] = "repo";
        args[2] = "42";
        args[3] = "101";
        
        vm.startPrank(address(bountyRegistry));
        
        bytes32 requestId1 = oracle.verifyContribution(bountyId1, claimer, args, 1, 100);
        bytes32 requestId2 = oracle.verifyContribution(bountyId2, attacker, args, 1, 100);
        
        vm.stopPrank();
        
        // ✅ FIX: With nonce in MockFunctionsRouter, these will be different
        assertTrue(requestId1 != requestId2);
        
        // Verify both requests are active
        (, , bool active1) = oracle.requests(requestId1);
        (, , bool active2) = oracle.requests(requestId2);
        assertTrue(active1);
        assertTrue(active2);
    }
    
    function test_FullFlow_SuccessfulClaim() public {
        bytes32 bountyId = keccak256(abi.encodePacked("full", "flow"));
        string[] memory args = new string[](4);
        args[0] = "vihaan1016";
        args[1] = "MergeMint";
        args[2] = "42";
        args[3] = "101";
        
        // Step 1: BountyRegistry calls verifyContribution
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        // Step 2: Verify request was stored
        (bytes32 storedBountyId, address storedClaimant, bool active) = oracle.requests(requestId);
        assertEq(storedBountyId, bountyId);
        assertEq(storedClaimant, claimer);
        assertTrue(active);
        
        // Step 3: Chainlink fulfills with success
        bytes memory response = abi.encode(true, "bountyHunter69");
        bytes memory err = "";
        
        vm.prank(address(router));
        oracle.handleOracleFulfillment(requestId, response, err);
        
        // Step 4: Verify bounty payout was triggered
        assertEq(bountyRegistry.payoutCallCount(), 1);
        assertEq(bountyRegistry.lastPayoutBountyId(), bountyId);
        assertEq(bountyRegistry.lastPayoutRecipient(), claimer);
        
        // Step 5: Verify request is deactivated
        (, , bool activeAfter) = oracle.requests(requestId);
        assertFalse(activeAfter);
    }
    
    function testFuzz_VerifyContribution_DifferentBountyIds(bytes32 bountyId) public {
        vm.assume(bountyId != bytes32(0));
        
        string[] memory args = new string[](4);
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, claimer, args, 1, 100);
        
        (bytes32 storedBountyId, , bool active) = oracle.requests(requestId);
        assertEq(storedBountyId, bountyId);
        assertTrue(active);
    }
    
    function testFuzz_VerifyContribution_DifferentClaimers(address _claimer) public {
        vm.assume(_claimer != address(0));
        
        bytes32 bountyId = keccak256(abi.encodePacked("test"));
        string[] memory args = new string[](4);
        
        vm.prank(address(bountyRegistry));
        bytes32 requestId = oracle.verifyContribution(bountyId, _claimer, args, 1, 100);
        
        (, address storedClaimant, bool active) = oracle.requests(requestId);
        assertEq(storedClaimant, _claimer);
        assertTrue(active);
    }
}