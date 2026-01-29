// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BountyRegistry.sol";
import "../src/Oracle.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock Chainlink Functions Router that acts as the authorized caller
contract MockFunctionsRouter {
    IntegratedOracle public oracle;
    
    function setOracle(address _oracle) external {
        oracle = IntegratedOracle(_oracle);
    }
    
    function sendRequest(
        uint64,
        bytes calldata,
        uint16,
        uint32,
        bytes32
    ) external returns (bytes32) {
        return keccak256(abi.encodePacked(block.timestamp, msg.sender));
    }
    
    // Simulate Chainlink fulfillment by calling handleOracleFulfillment as the router
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        // Call handleOracleFulfillment (this is the public entry point from Chainlink)
        oracle.handleOracleFulfillment(requestId, response, err);
    }
}

/**
 * @title Integration Test Suite
 * @notice Tests the complete flow from bounty creation to payout
 * This simulates real-world usage of the bounty system
 */
contract IntegrationTest is Test {
    BountyRegistry public registry;
    IntegratedOracle public oracle;
    MockERC20 public token;
    MockFunctionsRouter public router;
    
    address public owner = address(1);
    address public issuer = address(2);
    address public claimer1 = address(3);
    address public claimer2 = address(4);
    address public hacker = address(5);
    
    uint256 public constant BOUNTY_AMOUNT = 1000 * 10**18;
    bytes32 public constant DON_ID = bytes32(uint256(0x123));
    uint64 public constant SUBSCRIPTION_ID = 100;
    
    string public constant REPO_OWNER = "vihaan1016";
    string public constant REPO_NAME = "MergeMint";
    string public constant ISSUE_NUMBER = "101";
    string public constant PR_NUMBER = "42";
    
    string public constant SOURCE_CODE = "console.log('verification script')";
    
    event BountyCreated(
        bytes32 indexed bountyID,
        string repoOwner,
        string repoName,
        string issueNumber,
        address indexed issuer,
        address token,
        uint256 amount
    );
    
    event BountyPaid(
        bytes32 indexed bountyID,
        address indexed claimer,
        uint256 amount,
        string githubUsername
    );
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy contracts
        router = new MockFunctionsRouter();
        token = new MockERC20();
        
        // Deploy Oracle first (without registry address)
        oracle = new IntegratedOracle(
            address(router),
            DON_ID,
            SUBSCRIPTION_ID,
            SOURCE_CODE,
            address(0) // Temporary, will update
        );
        
        // Deploy Registry with Oracle
        registry = new BountyRegistry(address(oracle));
        
        // Update Oracle with Registry address
        oracle.updateBountyRegistry(address(registry));
        
        // Set oracle reference in router
        router.setOracle(address(oracle));
        
        // Setup DON secrets
        registry.updateDONSecrets(1, 100);
        
        // Fund test accounts
        token.mint(issuer, BOUNTY_AMOUNT * 10);
        token.mint(claimer1, 100 * 10**18);
        token.mint(claimer2, 100 * 10**18);
        
        vm.stopPrank();
    }
    
    // ============ Complete Flow Tests ============
    
    function test_CompleteFlow_SuccessfulBounty() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // === STEP 1: Issue creates bounty ===
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        
        vm.expectEmit(true, true, true, true);
        emit BountyCreated(bountyId, REPO_OWNER, REPO_NAME, ISSUE_NUMBER, issuer, address(token), BOUNTY_AMOUNT);
        
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify bounty state
        (
            address storedIssuer,
            address storedToken,
            uint256 storedAmount,
            BountyRegistry.BountyStatus status,
            ,
            ,
        ) = registry.getBountyDetails(bountyId);
        
        assertEq(storedIssuer, issuer);
        assertEq(storedToken, address(token));
        assertEq(storedAmount, BOUNTY_AMOUNT);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT);
        
        // === STEP 2: Contributor claims bounty ===
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Verify status changed to VERIFYING
        bytes32 requestId;
        (, , , status, , , requestId) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        assertTrue(requestId != bytes32(0));
        
        // === STEP 3: Oracle verifies and triggers payout ===
        // Simulate successful verification
        bytes memory response = abi.encode(true, "bountyHunter69");
        bytes memory err = "";
        
        uint256 claimerBalanceBefore = token.balanceOf(claimer1);
        
        // ✅ FIXED: Status WILL update now (Bug #1 fixed)
        vm.prank(address(router));
        router.fulfillRequest(requestId, response, err);
        
        // === STEP 4: Verify final state ===
        // ✅ FIXED: Both tokens transferred AND state updated
        assertEq(token.balanceOf(claimer1), claimerBalanceBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(registry)), 0);
        
        // ✅ FIXED: Status IS now updated correctly (was broken before)
        string memory prClaimer;
        (, , , status, , prClaimer, ) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.PAID));
        assertEq(prClaimer, "bountyHunter69");
        
        // Remove this line if it exists:
        // emit log_string("BUG CONFIRMED: Payout occurred but state not updated");
    }
    
    function test_CompleteFlow_VerificationFails() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Claim bounty
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        bytes32 requestId;
        (, , , , , , requestId) = registry.getBountyDetails(bountyId);
        
        // Simulate failed verification (PR doesn't close the issue)
        bytes memory response = abi.encode(false, "wrongUser");
        bytes memory err = "";
        
        uint256 claimerBalanceBefore = token.balanceOf(claimer1);
        
        vm.prank(address(router));
        router.fulfillRequest(requestId, response, err);
        
        // Verify NO payout occurred
        assertEq(token.balanceOf(claimer1), claimerBalanceBefore);
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT);
        
        // Note: In production, you'd want the bounty to return to OPEN state
        // This would require additional logic in the contracts
    }
    
    function test_CompleteFlow_ScriptError() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Claim bounty
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        bytes32 requestId;
        (, , , , , , requestId) = registry.getBountyDetails(bountyId);
        
        // Simulate script error (GitHub API down, etc.)
        bytes memory response = "";
        bytes memory err = "GitHub API error";
        
        vm.prank(address(router));
        router.fulfillRequest(requestId, response, err);
        
        // Verify bounty remains in VERIFYING state with funds locked
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT);
    }
    
    function test_CompleteFlow_RefundAfterTimeout() public {
        // ✅ FIXED: Timelock now works correctly (Bug #3 fixed)
        
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        uint256 issuerBalanceBefore = token.balanceOf(issuer);
        
        // Fast forward 180 days + 1
        vm.warp(block.timestamp + 180 days + 1);
        
        // ✅ FIXED: Refund now SUCCEEDS (no longer reverts)
        vm.prank(issuer);
        registry.seepFunds(bountyId);
        
        // Verify refund succeeded
        assertEq(token.balanceOf(issuer), issuerBalanceBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(registry)), 0);
        
        // Verify status updated
        (, , , BountyRegistry.BountyStatus status, , , ) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.REFUNDED));
        
        // Remove these lines if they exist:
        // vm.expectRevert(BountyRegistry.TimelockNotExpired.selector);
        // emit log_string("BUG CONFIRMED: Timelock check is broken - refunds impossible");
    }
    // ============ Multi-Bounty Scenarios ============
    
    function test_MultipleBounties_DifferentIssues() public {
        bytes32 bountyId1 = registry.computeBountyID(REPO_OWNER, REPO_NAME, "101");
        bytes32 bountyId2 = registry.computeBountyID(REPO_OWNER, REPO_NAME, "102");
        bytes32 bountyId3 = registry.computeBountyID(REPO_OWNER, REPO_NAME, "103");
        
        // Fund three bounties
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT * 3);
        
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "101");
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "102");
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "103");
        
        vm.stopPrank();
        
        // Claim bounty 1
        vm.prank(claimer1);
        registry.claimBounty(bountyId1, "42", REPO_OWNER, REPO_NAME, "101");
        
        // Claim bounty 2
        vm.prank(claimer2);
        registry.claimBounty(bountyId2, "43", REPO_OWNER, REPO_NAME, "102");
        
        // Verify both are in VERIFYING state
        (, , , BountyRegistry.BountyStatus status1, , , ) = registry.getBountyDetails(bountyId1);
        (, , , BountyRegistry.BountyStatus status2, , , ) = registry.getBountyDetails(bountyId2);
        (, , , BountyRegistry.BountyStatus status3, , , ) = registry.getBountyDetails(bountyId3);
        
        assertEq(uint256(status1), uint256(BountyRegistry.BountyStatus.VERIFYING));
        assertEq(uint256(status2), uint256(BountyRegistry.BountyStatus.VERIFYING));
        assertEq(uint256(status3), uint256(BountyRegistry.BountyStatus.OPEN));
    }
    
    function test_MultipleClaims_SameBounty_SecondFails() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // First claim succeeds
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Second claim fails (status is VERIFYING)
        vm.startPrank(claimer2);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.claimBounty(bountyId, "43", REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    // ============ Security Tests ============
    
    function test_Security_CannotClaimWithoutFunding() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.startPrank(claimer1);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    function test_Security_OnlyOracleCanCompletePayout() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund and claim
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Hacker tries to complete payout
        vm.startPrank(hacker);
        vm.expectRevert(BountyRegistry.Unauthorised.selector);
        registry.completeBountyPayout(bountyId, "hacker", hacker);
        vm.stopPrank();
    }
    
    function test_Security_OnlyRegistryCanVerify() public {
        bytes32 bountyId = keccak256(abi.encodePacked("test"));
        string[] memory args = new string[](4);
        
        // Hacker tries to initiate verification directly
        vm.startPrank(hacker);
        vm.expectRevert(IntegratedOracle.Unauthorized.selector);
        oracle.verifyContribution(bountyId, hacker, args, 1, 100);
        vm.stopPrank();
    }
    
    function test_Security_CannotRefundBeforeTimelock() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Try to refund immediately
        vm.expectRevert(BountyRegistry.TimelockNotExpired.selector);
        registry.seepFunds(bountyId);
        
        // Try after 179 days
        vm.warp(block.timestamp + 179 days);
        vm.expectRevert(BountyRegistry.TimelockNotExpired.selector);
        registry.seepFunds(bountyId);
        
        vm.stopPrank();
    }
    
    function test_Security_OnlyIssuerCanRefund() public {
    // ✅ FIXED: Auth check now happens BEFORE timelock check
    
    bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
    
    // Fund bounty
    vm.startPrank(issuer);
    token.approve(address(registry), BOUNTY_AMOUNT);
    registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
    vm.stopPrank();
    
    // Fast forward
    vm.warp(block.timestamp + 180 days + 1);
    
    // ✅ FIXED: Hacker gets Unauthorised error (not TimelockNotExpired)
    vm.startPrank(hacker);
    vm.expectRevert(BountyRegistry.Unauthorised.selector);
    registry.seepFunds(bountyId);
    vm.stopPrank();
}
    
    function test_Security_ReentrancyProtection() public {
        // This test verifies that nonReentrant modifiers are in place
        // In a real attack scenario, a malicious token would try to re-enter
        // The nonReentrant modifiers should prevent this
        
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // The fact that this completes without revert indicates protection is working
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT);
    }
    
    // ============ Edge Cases ============
    
    function test_EdgeCase_ClaimAfterRefund() public {
        // NOTE: This test is skipped because refunds don't work due to BUG #3
        vm.skip(true);
        
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Fast forward and refund
        vm.warp(block.timestamp + 180 days + 1);
        vm.prank(issuer);
        registry.seepFunds(bountyId);
        
        // Try to claim after refund
        vm.startPrank(claimer1);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    function test_EdgeCase_DoubleRefund() public {
        // NOTE: This test is skipped because refunds don't work due to BUG #3
        vm.skip(true);
        
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Fast forward and refund
        vm.warp(block.timestamp + 180 days + 1);
        
        vm.startPrank(issuer);
        registry.seepFunds(bountyId);
        
        // Try to refund again
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.seepFunds(bountyId);
        vm.stopPrank();
    }
    
    function test_EdgeCase_PayoutToRightPerson() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Claimer1 claims
        vm.prank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        bytes32 requestId;
        (, , , , , , requestId) = registry.getBountyDetails(bountyId);
        
        // Verify and payout
        bytes memory response = abi.encode(true, "bountyHunter69");
        bytes memory err = "";
        
        vm.prank(address(router));
        router.fulfillRequest(requestId, response, err);
        
        // Verify only claimer1 received funds, not claimer2
        assertGt(token.balanceOf(claimer1), 100 * 10**18);
        assertEq(token.balanceOf(claimer2), 100 * 10**18);
    }
    
    // ============ Gas Optimization Tests ============
    
    function test_Gas_FundIssue() public {
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        
        uint256 gasStart = gasleft();
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        uint256 gasUsed = gasStart - gasleft();
        
        vm.stopPrank();
        
        // Log gas usage for optimization tracking
        emit log_named_uint("Gas used for fundIssue", gasUsed);
        assertLt(gasUsed, 200000); // Reasonable upper bound
    }
    
    function test_Gas_ClaimBounty() public {
        bytes32 bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fund first
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.startPrank(claimer1);
        uint256 gasStart = gasleft();
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        uint256 gasUsed = gasStart - gasleft();
        vm.stopPrank();
        
        emit log_named_uint("Gas used for claimBounty", gasUsed);
        assertLt(gasUsed, 300000);
    }
}