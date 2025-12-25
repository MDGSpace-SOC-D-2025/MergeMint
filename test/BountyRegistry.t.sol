// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/BountyRegistry.sol"; // Adjust path if your contract is in 'contracts/'
import "./MockUSDC.sol";

contract BountyRegistryTest is Test {
    BountyRegistry public registry;
    MockUSDC public token;

    address public maintainer = address(0x1);
    address public contributor = address(0x2);

    // Bounty Details
    uint256 public constant AMOUNT = 1000 * 10**18;
    string public repoOwner = "vihaan1016";
    string public repoName = "MergeMint";
    string public issueNumber = "42";

    // Setup runs before every test
    function setUp() public {
        // 1. Deploy Token & Registry
        token = new MockUSDC();
        registry = new BountyRegistry();

        // 2. Fund the maintainer wallet
        token.mint(maintainer, AMOUNT * 10);

        // 3. Label addresses for clearer logs
        vm.label(maintainer, "Maintainer");
        vm.label(address(registry), "BountyVault");
    }

    // --- TEST 1: SUCCESSFUL FUNDING ---
    function test_FundIssue() public {
        // Switch context to Maintainer
        vm.startPrank(maintainer);

        // Approve Registry to spend tokens
        token.approve(address(registry), AMOUNT);

        // Prepare struct
        BountyRegistry.IssueParams memory params = BountyRegistry.IssueParams({
            repoOwner: repoOwner,
            repoName: repoName,
            issueNumber: issueNumber
        });

        // ACTION: Fund the issue
        registry.fundIssue(address(token), AMOUNT, params);

        vm.stopPrank();

        // ASSERTIONS
        // 1. Check Registry Balance
        assertEq(token.balanceOf(address(registry)), AMOUNT);

        // 2. Check Bounty State
        bytes32 bountyId = registry.computeBountyId(repoOwner, repoName, issueNumber);
        
        // Destructure return values (tuple) from mapping
        (
            address _issuer,
            address _token,
            uint256 _amount,
            BountyRegistry.BountyStatus _status,
            , // creationTime (skip)
             // prAuthor (skip)
        ) = registry.bounties(bountyId);

        assertEq(_issuer, maintainer);
        assertEq(_amount, AMOUNT);
        // Enum: 0 = OPEN
        assertEq(uint(_status), 0);
    }

    // --- TEST 2: PREVENT DUPLICATE BOUNTIES ---
    function test_RevertIf_BountyExists() public {
        vm.startPrank(maintainer);
        token.approve(address(registry), AMOUNT * 2);

        BountyRegistry.IssueParams memory params = BountyRegistry.IssueParams(
            repoOwner, repoName, issueNumber
        );

        // First funding
        registry.fundIssue(address(token), AMOUNT, params);

        // Second funding (Should fail)
        vm.expectRevert("Bounty already exists for this issue");
        registry.fundIssue(address(token), AMOUNT, params);
        
        vm.stopPrank();
    }

    // --- TEST 3: REFUND TIMELOCK (Time Travel) ---
    function test_SweepFunds_Timelock() public {
        // 1. Setup Bounty
        vm.startPrank(maintainer);
        token.approve(address(registry), AMOUNT);
        registry.fundIssue(address(token), AMOUNT, BountyRegistry.IssueParams(repoOwner, repoName, issueNumber));
        vm.stopPrank();

        bytes32 bountyId = registry.computeBountyId(repoOwner, repoName, issueNumber);

        // 2. Try to sweep immediately (Should Fail)
        vm.startPrank(maintainer);
        vm.expectRevert("Timelock not yet expired");
        registry.sweepFunds(bountyId);

        // 3. TIME TRAVEL: Move forward 180 days + 1 second
        vm.warp(block.timestamp + 180 days + 1);

        // 4. Try to sweep again (Should Success)
        uint256 preBalance = token.balanceOf(maintainer);
        registry.sweepFunds(bountyId);
        uint256 postBalance = token.balanceOf(maintainer);

        // Assert balance increased by AMOUNT
        assertEq(postBalance - preBalance, AMOUNT);
        
        vm.stopPrank();
    }
}