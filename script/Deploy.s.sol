// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Oracle.sol";

contract DeployOracle is Script {
    function run() external {
        // 1. Load Environment Variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint64 subscriptionId = uint64(vm.envUint("SUBSCRIPTION_ID"));
        
        // 2. Chainlink Sepolia Config
        address router = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
        bytes32 donId = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000; // "fun-ethereum-sepolia-1"

        // 3. Read the Oracle Script Source Code
        // Foundry can read files from your disk during deployment!
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/oracle/verification.js");
        string memory sourceCode = vm.readFile(path);

        // 4. Deploy
        vm.startBroadcast(deployerPrivateKey);

        Oracle oracle = new Oracle(
            router,
            donId,
            subscriptionId,
            sourceCode
        );

        console.log("Oracle Deployed to:", address(oracle));
        vm.stopBroadcast();
    }
}