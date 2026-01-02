// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Oracle.sol";
import "../src/BountyRegistry.sol";

contract DeployContracts is Script {
    function run() external {
        // 1. Load Environment Variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint64 subscriptionId = uint64(vm.envUint("SUBSCRIPTION_ID"));
        
        // 2. Chainlink Sepolia Config
        address router = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
        bytes32 donId = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000; // "fun-ethereum-sepolia-1"

        // 3. Read the Oracle Script Source Code
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/oracle/verification.js");
        string memory sourceCode = vm.readFile(path);

        // 4. Start Deployment
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Oracle first (without BountyRegistry address)
        IntegratedOracle oracle = new IntegratedOracle(
            router,
            donId,
            subscriptionId,
            sourceCode,
            address(0) // Temporary, will update after BountyRegistry deployment
        );
        console.log("Oracle Deployed to:", address(oracle));

        // Deploy BountyRegistry with Oracle address
        BountyRegistry registry = new BountyRegistry(address(oracle));
        console.log("BountyRegistry Deployed to:", address(registry));

        // Update Oracle with BountyRegistry address
        oracle.updateBountyRegistry(address(registry));
        console.log("Oracle updated with BountyRegistry address");

        // Log final addresses
        console.log("\n=== Deployment Complete ===");
        console.log("Oracle:", address(oracle));
        console.log("BountyRegistry:", address(registry));
        console.log("DON Subscription ID:", subscriptionId);
        console.log("\nNext Steps:");
        console.log("1. Add Oracle contract as consumer to your Chainlink subscription");
        console.log("2. Upload DON secrets using uploadSecrets.js");
        console.log("3. Call registry.updateDONSecrets(slotId, version) with the values from step 2");

        vm.stopBroadcast();
    }
}

contract DeployOracleOnly is Script {
    function run() external {
        // 1. Load Environment Variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint64 subscriptionId = uint64(vm.envUint("SUBSCRIPTION_ID"));
        address bountyRegistry = vm.envAddress("BOUNTY_REGISTRY_ADDRESS");
        
        // 2. Chainlink Sepolia Config
        address router = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0;
        bytes32 donId = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000;

        // 3. Read the Oracle Script Source Code
        string memory root = vm.projectRoot();
        string memory path = string.concat(root, "/oracle/verification.js");
        string memory sourceCode = vm.readFile(path);

        // 4. Deploy Oracle
        vm.startBroadcast(deployerPrivateKey);

        IntegratedOracle oracle = new IntegratedOracle(
            router,
            donId,
            subscriptionId,
            sourceCode,
            bountyRegistry
        );

        console.log("Oracle Deployed to:", address(oracle));
        console.log("Connected to BountyRegistry:", bountyRegistry);

        vm.stopBroadcast();
    }
}

contract DeployBountyRegistryOnly is Script {
    function run() external {
        // 1. Load Environment Variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        
        // 2. Deploy BountyRegistry
        vm.startBroadcast(deployerPrivateKey);

        BountyRegistry registry = new BountyRegistry(oracleAddress);

        console.log("BountyRegistry Deployed to:", address(registry));
        console.log("Connected to Oracle:", oracleAddress);

        vm.stopBroadcast();
    }
}

contract UpdateOracleRegistry is Script {
    function run() external {
        // Update Oracle with BountyRegistry address after separate deployments
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address oracleAddress = vm.envAddress("ORACLE_ADDRESS");
        address registryAddress = vm.envAddress("BOUNTY_REGISTRY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        IntegratedOracle oracle = IntegratedOracle(oracleAddress);
        oracle.updateBountyRegistry(registryAddress);

        console.log("Oracle at", oracleAddress);
        console.log("Updated with BountyRegistry at", registryAddress);

        vm.stopBroadcast();
    }
}

contract UpdateDONSecrets is Script {
    function run() external {
        // Update DON secrets after running uploadSecrets.js
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address registryAddress = vm.envAddress("BOUNTY_REGISTRY_ADDRESS");
        uint8 slotId = uint8(vm.envUint("SECRETS_SLOT_ID"));
        uint64 version = uint64(vm.envUint("SECRETS_VERSION"));

        vm.startBroadcast(deployerPrivateKey);

        BountyRegistry registry = BountyRegistry(registryAddress);
        registry.updateDONSecrets(slotId, version);

        console.log("BountyRegistry at", registryAddress);
        console.log("Updated DON Secrets - Slot:", slotId, "Version:", version);

        vm.stopBroadcast();
    }
}