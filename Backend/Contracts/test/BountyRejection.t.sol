// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BountyRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token for testing
contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock Oracle for testing claim rejection
contract MockOracleForRejection {
    BountyRegistry public registry;
    
    constructor(address _registry) {
        registry = BountyRegistry(_registry);
    }
    
    function verifyContribution(
        bytes32 bountyID,
        address claimer,
        string[] calldata,
        uint8,
        uint64
    ) external returns (bytes32 requestId) {
        requestId = keccak256(abi.encodePacked(bountyID, claimer, block.timestamp));
        return requestId;
    }
    
    // Simulate failed verification
    function rejectClaim(bytes32 bountyId) external {
        registry.rejectBountyClaim(bountyId);
    }
    
    // Simulate successful verification
    function completePayout(
        bytes32 bountyId,
        string memory githubUsername,
        address receiver
    ) external {
        registry.completeBountyPayout(bountyId, githubUsername, receiver);
    }
}

contract BountyRejectionTest is Test {
    BountyRegistry public registry;
    MockERC20 public token;
    MockOracleForRejection public oracle;
    
    address public owner = address(1);
    address public issuer = address(2);
    address public claimer1 = address(3);
    address public claimer2 = address(4);
    
    uint256 public constant BOUNTY_AMOUNT = 1000 * 10**18;
    string public constant REPO_OWNER = "vihaan1016";
    string public constant REPO_NAME = "MergeMint";
    string public constant ISSUE_NUMBER = "101";
    string public constant PR_NUMBER_1 = "42";
    string public constant PR_NUMBER_2 = "43";
    
    bytes32 public bountyId;
    
    event BountyStatusChanged(
        bytes32 indexed bountyID,
        BountyRegistry.BountyStatus newStatus
    );
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy contracts
        registry = new BountyRegistry(address(1)); // Temporary oracle address
        oracle = new MockOracleForRejection(address(registry));
        registry.updateOracle(address(oracle));
        
        token = new MockERC20();
        
        // Setup test accounts
        token.mint(issuer, BOUNTY_AMOUNT * 10);
        token.mint(claimer1, BOUNTY_AMOUNT);
        token.mint(claimer2, BOUNTY_AMOUNT);
        
        vm.stopPrank();
        
        // Compute expected bounty ID
        bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
    }
    
    // ============ Test: Claim Rejection - Basic Flow ============
    
    function test_RejectBountyClaim_Success() public {
        // Step 1: Fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify bounty is OPEN
        (,,,BountyRegistry.BountyStatus status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        
        // Step 2: Claimer submits a claim
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify bounty is now VERIFYING
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        
        // Get the activeRequestId separately
        (,,,,, , bytes32 activeRequestId) = registry.getBountyDetails(bountyId);
        assertNotEq(activeRequestId, bytes32(0));
        
        // Step 3: Oracle rejects the claim (verification failed)
        vm.startPrank(address(oracle));
        
        vm.expectEmit(true, false, false, true);
        emit BountyStatusChanged(bountyId, BountyRegistry.BountyStatus.OPEN);
        
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        // Verify bounty is back to OPEN
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        
        // Get the activeRequestId separately
        (,,,,, , activeRequestId) = registry.getBountyDetails(bountyId);
        assertEq(activeRequestId, bytes32(0));
    }
    
    // ============ Test: Multiple Claim Attempts ============
    
    function test_MultipleClaimAttempts_AfterRejection() public {
        // Step 1: Fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 2: First claim attempt
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        (,,,BountyRegistry.BountyStatus status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        
        // Step 3: Oracle rejects the first claim
        vm.startPrank(address(oracle));
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        
        // Step 4: Second claim attempt by different claimer
        vm.startPrank(claimer2);
        registry.claimBounty(bountyId, PR_NUMBER_2, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
    }
    
    // ============ Test: Successful Claim After Failed Attempt ============
    
    function test_SuccessfulClaimAfterFailedAttempt() public {
        // Step 1: Fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        uint256 oracleBalanceBefore = token.balanceOf(address(oracle));
        
        // Step 2: First claim attempt fails
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 3: Oracle rejects the claim
        vm.startPrank(address(oracle));
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        // Step 4: Second claim attempt succeeds
        vm.startPrank(claimer2);
        registry.claimBounty(bountyId, PR_NUMBER_2, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 5: Oracle completes the payout for the second claim
        vm.startPrank(address(oracle));
        oracle.completePayout(bountyId, "claimer2_github_username", claimer2);
        vm.stopPrank();
        
        // Verify bounty is now PAID
        (,,,BountyRegistry.BountyStatus status,,string memory prClaimer,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.PAID));
        assertEq(keccak256(abi.encodePacked(prClaimer)), keccak256(abi.encodePacked("claimer2_github_username")));
        
        // Verify claimer2 received the bounty
        assertEq(token.balanceOf(claimer2), BOUNTY_AMOUNT + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(registry)), 0);
    }
    
    // ============ Test: Authorization & Error Cases ============
    
    function test_RejectBountyClaim_RevertWhen_NotOracle() public {
        // Step 1: Fund and claim the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 2: Attempt rejection from non-oracle address
        vm.startPrank(address(999)); // Random address
        vm.expectRevert(BountyRegistry.Unauthorised.selector);
        registry.rejectBountyClaim(bountyId);
        vm.stopPrank();
    }
    
    function test_RejectBountyClaim_RevertWhen_NotVerifying() public {
        // Step 1: Fund the bounty (state is OPEN)
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 2: Try to reject while bounty is OPEN
        vm.startPrank(address(oracle));
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
    }
    
    function test_RejectBountyClaim_ClearsActiveRequestId() public {
        // Step 1: Fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Step 2: Claim bounty
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify activeRequestId is set
        bytes32 activeRequestId;
        (,,,,,, activeRequestId) = registry.getBountyDetails(bountyId);
        assertNotEq(activeRequestId, bytes32(0));
        
        // Step 3: Oracle rejects the claim
        vm.startPrank(address(oracle));
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        // Verify activeRequestId is cleared
        (,,,,,, activeRequestId) = registry.getBountyDetails(bountyId);
        assertEq(activeRequestId, bytes32(0));
    }
    
    // ============ Test: State Transitions ============
    
    function test_BountyStateTransitions() public {
        // Step 1: Fund bounty (OPEN)
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        (,,,BountyRegistry.BountyStatus status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        
        // Step 2: Claim bounty (VERIFYING)
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        
        // Step 3: Reject claim (back to OPEN)
        vm.startPrank(address(oracle));
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        
        // Step 4: Claim bounty again (VERIFYING)
        vm.startPrank(claimer2);
        registry.claimBounty(bountyId, PR_NUMBER_2, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        
        // Step 5: Complete payout (PAID)
        vm.startPrank(address(oracle));
        oracle.completePayout(bountyId, "claimer2", claimer2);
        vm.stopPrank();
        
        (,,,status,,,) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.PAID));
    }
    
    // ============ Test: Fund Recovery After Rejection ============
    
    function test_FundsPreservedAfterRejection() public {
        uint256 registryBalanceBefore;
        uint256 registryBalanceAfter;
        
        // Step 1: Fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        registryBalanceBefore = token.balanceOf(address(registry));
        assertEq(registryBalanceBefore, BOUNTY_AMOUNT);
        
        // Step 2: Claim and reject
        vm.startPrank(claimer1);
        registry.claimBounty(bountyId, PR_NUMBER_1, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.startPrank(address(oracle));
        oracle.rejectClaim(bountyId);
        vm.stopPrank();
        
        registryBalanceAfter = token.balanceOf(address(registry));
        
        // Verify funds are still in the contract
        assertEq(registryBalanceAfter, BOUNTY_AMOUNT);
        assertEq(registryBalanceBefore, registryBalanceAfter);
    }
}
