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

// Mock Oracle for testing
contract MockOracle {
    bytes32 public lastRequestId;
    bytes32 public lastBountyId;
    address public lastClaimer;
    
    function verifyContribution(
        bytes32 bountyID,
        address claimer,
        string[] calldata,
        uint8,
        uint64
    ) external returns (bytes32 requestId) {
        lastBountyId = bountyID;
        lastClaimer = claimer;
        requestId = keccak256(abi.encodePacked(bountyID, claimer, block.timestamp));
        lastRequestId = requestId;
        return requestId;
    }
}

contract BountyRegistryTest is Test {
    BountyRegistry public registry;
    MockERC20 public token;
    MockOracle public oracle;
    
    address public owner = address(1);
    address public issuer = address(2);
    address public claimer = address(3);
    address public attacker = address(4);
    
    uint256 public constant BOUNTY_AMOUNT = 1000 * 10**18;
    string public constant REPO_OWNER = "vihaan1016";
    string public constant REPO_NAME = "MergeMint";
    string public constant ISSUE_NUMBER = "101";
    string public constant PR_NUMBER = "42";
    
    bytes32 public bountyId;
    
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
    
    event BountyStatusChanged(
        bytes32 indexed bountyID,
        BountyRegistry.BountyStatus newStatus
    );
    
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
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy contracts
        oracle = new MockOracle();
        registry = new BountyRegistry(address(oracle));
        token = new MockERC20();
        
        // Setup test accounts
        token.mint(issuer, BOUNTY_AMOUNT * 10);
        token.mint(claimer, BOUNTY_AMOUNT);
        
        vm.stopPrank();
        
        // Compute expected bounty ID
        bountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
    }
    
    // ============ fundIssue Tests ============
    
    function test_FundIssue_Success() public {
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        
        vm.expectEmit(true, true, true, true);
        emit BountyCreated(bountyId, REPO_OWNER, REPO_NAME, ISSUE_NUMBER, issuer, address(token), BOUNTY_AMOUNT);
        
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify bounty details
        (
            address storedIssuer,
            address storedToken,
            uint256 storedAmount,
            BountyRegistry.BountyStatus status,
            uint256 creationTime,
            string memory prClaimer,
            bytes32 activeRequestId
        ) = registry.getBountyDetails(bountyId);
        
        assertEq(storedIssuer, issuer);
        assertEq(storedToken, address(token));
        assertEq(storedAmount, BOUNTY_AMOUNT);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.OPEN));
        assertEq(creationTime, block.timestamp);
        assertEq(prClaimer, "");
        assertEq(activeRequestId, bytes32(0));
        
        // Verify token transfer
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT);
        assertEq(token.balanceOf(issuer), BOUNTY_AMOUNT * 9);
    }
    
    function test_FundIssue_RevertWhen_ZeroAmount() public {
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        
        vm.expectRevert(BountyRegistry.InvalidAmount.selector);
        registry.fundIssue(0, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.stopPrank();
    }
    
    function test_FundIssue_RevertWhen_ZeroTokenAddress() public {
        vm.startPrank(issuer);
        
        vm.expectRevert(BountyRegistry.InvalidAmount.selector);
        registry.fundIssue(BOUNTY_AMOUNT, address(0), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.stopPrank();
    }
    
    function test_FundIssue_RevertWhen_BountyAlreadyExists() public {
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT * 2);
        
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.expectRevert(BountyRegistry.BountyExists.selector);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.stopPrank();
    }
    
    function test_FundIssue_RevertWhen_InsufficientAllowance() public {
        vm.startPrank(issuer);
        
        vm.expectRevert();
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        vm.stopPrank();
    }
    
    function test_FundIssue_ComputeCorrectBountyId() public {
        bytes32 expected = keccak256(abi.encodePacked(REPO_OWNER, REPO_NAME, ISSUE_NUMBER));
        bytes32 computed = registry.computeBountyID(REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        assertEq(computed, expected);
    }
    
    // ============ claimBounty Tests ============
    
    function test_ClaimBounty_Success() public {
        // First fund the bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Update DON secrets
        vm.prank(owner);
        registry.updateDONSecrets(1, 100);
        
        // Claim bounty
        vm.startPrank(claimer);
        
        vm.expectEmit(true, false, false, true);
        emit BountyStatusChanged(bountyId, BountyRegistry.BountyStatus.VERIFYING);
        
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Verify status changed
        (, , , BountyRegistry.BountyStatus status, , , bytes32 activeRequestId) = registry.getBountyDetails(bountyId);
        assertEq(uint256(status), uint256(BountyRegistry.BountyStatus.VERIFYING));
        assertTrue(activeRequestId != bytes32(0));
        
        // Verify oracle was called
        assertEq(oracle.lastBountyId(), bountyId);
        assertEq(oracle.lastClaimer(), claimer);
    }
    
    function test_ClaimBounty_RevertWhen_BountyDoesNotExist() public {
        bytes32 fakeBountyId = keccak256(abi.encodePacked("fake", "bounty", "id"));
        
        vm.startPrank(claimer);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.claimBounty(fakeBountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    function test_ClaimBounty_RevertWhen_AlreadyClaimed() public {
        // Fund and claim bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.prank(owner);
        registry.updateDONSecrets(1, 100);
        
        vm.prank(claimer);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Try to claim again
        vm.startPrank(attacker);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.claimBounty(bountyId, "43", REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    // ============ completeBountyPayout Tests ============
    
    function test_CompleteBountyPayout_Success() public {
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Claim bounty
        vm.prank(owner);
        registry.updateDONSecrets(1, 100);
        
        vm.prank(claimer);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Complete payout (as oracle)
        uint256 claimerBalanceBefore = token.balanceOf(claimer);
        
        vm.startPrank(address(oracle));
        
        vm.expectEmit(true, false, false, true);
        emit BountyStatusChanged(bountyId, BountyRegistry.BountyStatus.PAID);
        
        vm.expectEmit(true, true, false, true);
        emit BountyPaid(bountyId, claimer, BOUNTY_AMOUNT, "bountyHunter69");
        
        registry.completeBountyPayout(bountyId, "bountyHunter69", claimer);
        vm.stopPrank();
        
        // Verify payout
        assertEq(token.balanceOf(claimer), claimerBalanceBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(registry)), 0);
    }
    
    function test_CompleteBountyPayout_RevertWhen_NotOracle() public {
        // Fund and claim bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.prank(owner);
        registry.updateDONSecrets(1, 100);
        
        vm.prank(claimer);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Try to complete payout as attacker
        vm.startPrank(attacker);
        vm.expectRevert(BountyRegistry.Unauthorised.selector);
        registry.completeBountyPayout(bountyId, "attacker", attacker);
        vm.stopPrank();
    }
    
    function test_CompleteBountyPayout_RevertWhen_InvalidStatus() public {
        // Fund bounty but don't claim
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Try to complete payout without claim
        vm.startPrank(address(oracle));
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.completeBountyPayout(bountyId, "bountyHunter69", claimer);
        vm.stopPrank();
    }
    
    // ============ seepFunds Tests ============
    
    function test_SeepFunds_Success() public {
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        uint256 issuerBalanceBefore = token.balanceOf(issuer);
        
        // Fast forward time
        vm.warp(block.timestamp + 180 days + 1);
        
        vm.startPrank(issuer);
        
        vm.expectEmit(true, false, false, true);
        emit BountyStatusChanged(bountyId, BountyRegistry.BountyStatus.REFUNDED);
        
        vm.expectEmit(true, true, false, true);
        emit FundsRefunded(bountyId, issuer, BOUNTY_AMOUNT);
        
        registry.seepFunds(bountyId);
        vm.stopPrank();
        
        // Verify refund
        assertEq(token.balanceOf(issuer), issuerBalanceBefore + BOUNTY_AMOUNT);
        assertEq(token.balanceOf(address(registry)), 0);
    }
    
    function test_SeepFunds_RevertWhen_TimelockNotExpired() public {
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Try to refund immediately
        vm.startPrank(issuer);
        vm.expectRevert(BountyRegistry.TimelockNotExpired.selector);
        registry.seepFunds(bountyId);
        vm.stopPrank();
    }
    
    function test_SeepFunds_RevertWhen_NotIssuer() public {
        // Fund bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Fast forward time
        vm.warp(block.timestamp + 180 days + 1);
        
        // Try to refund as attacker
        vm.startPrank(attacker);
        vm.expectRevert(BountyRegistry.Unauthorised.selector);
        registry.seepFunds(bountyId);
        vm.stopPrank();
    }
    
    function test_SeepFunds_RevertWhen_BountyNotOpen() public {
        // Fund and claim bounty
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        vm.prank(owner);
        registry.updateDONSecrets(1, 100);
        
        vm.prank(claimer);
        registry.claimBounty(bountyId, PR_NUMBER, REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        
        // Fast forward time
        vm.warp(block.timestamp + 180 days + 1);
        
        // Try to refund when status is VERIFYING
        vm.startPrank(issuer);
        vm.expectRevert(BountyRegistry.InvalidStatus.selector);
        registry.seepFunds(bountyId);
        vm.stopPrank();
    }
    
    // ============ Admin Function Tests ============
    
    function test_UpdateDONSecrets_Success() public {
        vm.prank(owner);
        registry.updateDONSecrets(5, 200);
        
        assertEq(registry.secretsSlotID(), 5);
        assertEq(registry.secretsVersion(), 200);
    }
    
    function test_UpdateDONSecrets_RevertWhen_NotOwner() public {
        vm.startPrank(attacker);
        vm.expectRevert();
        registry.updateDONSecrets(5, 200);
        vm.stopPrank();
    }
    
    function test_UpdateOracle_Success() public {
        address newOracle = address(0x123);
        
        vm.prank(owner);
        registry.updateOracle(newOracle);
        
        assertEq(address(registry.oracle()), newOracle);
    }
    
    function test_UpdateOracle_RevertWhen_NotOwner() public {
        address newOracle = address(0x123);
        
        vm.startPrank(attacker);
        vm.expectRevert();
        registry.updateOracle(newOracle);
        vm.stopPrank();
    }
    
    // ============ Edge Cases & Integration Tests ============
    
    function test_MultipleBounties_DifferentIssues() public {
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT * 3);
        
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "101");
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "102");
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, "103");
        
        vm.stopPrank();
        
        assertEq(token.balanceOf(address(registry)), BOUNTY_AMOUNT * 3);
    }
    
    function test_DifferentTokens_SameBounty() public {
        MockERC20 token2 = new MockERC20();
        token2.mint(issuer, BOUNTY_AMOUNT);
        
        // Fund with first token
        vm.startPrank(issuer);
        token.approve(address(registry), BOUNTY_AMOUNT);
        registry.fundIssue(BOUNTY_AMOUNT, address(token), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
        
        // Cannot fund same bounty with different token
        vm.startPrank(issuer);
        token2.approve(address(registry), BOUNTY_AMOUNT);
        vm.expectRevert(BountyRegistry.BountyExists.selector);
        registry.fundIssue(BOUNTY_AMOUNT, address(token2), REPO_OWNER, REPO_NAME, ISSUE_NUMBER);
        vm.stopPrank();
    }
    
    function testFuzz_FundIssue_DifferentAmounts(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1000000 * 10**18);
        
        token.mint(issuer, amount);
        
        vm.startPrank(issuer);
        token.approve(address(registry), amount);
        registry.fundIssue(amount, address(token), REPO_OWNER, REPO_NAME, "999");
        vm.stopPrank();
        
        bytes32 testBountyId = registry.computeBountyID(REPO_OWNER, REPO_NAME, "999");
        (, , uint256 storedAmount, , , , ) = registry.getBountyDetails(testBountyId);
        
        assertEq(storedAmount, amount);
    }
}