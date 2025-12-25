const { SecretsManager } = require("@chainlink/functions-toolkit");
const { ethers } = require("ethers");
require("dotenv").config();

async function uploadSecrets() {
  // 0. Version Check
  if (!ethers.providers) {
    console.error("\n❌ CRITICAL ERROR: Ethers v6 detected.");
    console.error("   The Chainlink Toolkit requires Ethers v5.7.2.");
    console.error("   Please run: 'rm -rf node_modules && npm install' to fix this.\n");
    process.exit(1);
  }

  // 1. Config
  const routerAddress = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0";
  const donId = "fun-ethereum-sepolia-1";
  const gatewayUrls = [
    "https://01.functions-gateway.testnet.chain.link/",
    "https://02.functions-gateway.testnet.chain.link/",
  ];

  // --- DIAGNOSTIC: Connectivity Check (FIXED) ---
  console.log("📡 Testing Gateway Connectivity...");
  let isConnected = false;
  
  for (const url of gatewayUrls) {
    try {
      // Test with a simple GET request instead of HEAD
      const response = await fetch(url, { 
        method: "GET",
        headers: {
          'Accept': 'application/json'
        },
        timeout: 5000
      });
      
      // Gateway may return 400 or 405 for GET, but that means it's reachable
      if (response.status >= 200 && response.status < 500) {
        console.log(`   ✅ Gateway reachable: ${url} (status: ${response.status})`);
        isConnected = true;
        break; 
      }
    } catch (e) {
      console.log(`   ❌ Failed to reach ${url}: ${e.code || e.message}`);
    }
  }

  if (!isConnected) {
    throw new Error("Could not reach ANY Chainlink Gateway. Check your internet connection.");
  }
  // -------------------------------------

  // 2. Setup Wallet (Ethers v5 Syntax)
  if (!process.env.PRIVATE_KEY) throw Error("Missing PRIVATE_KEY in .env");
  
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.RPC_URL || "https://rpc.sepolia.org"
  );
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log(`\n🔑 Using wallet: ${wallet.address}`);

  // 3. Initialize Manager
  console.log("🔌 Initializing Secrets Manager (RPC check)...");
  
  const secretsManager = new SecretsManager({
    signer: wallet,
    functionsRouterAddress: routerAddress,
    donId: donId,
  });

  await secretsManager.initialize();
  console.log("   ✅ Secrets Manager initialized");

  // 4. Encrypt & Upload
  console.log("\n🔐 Encrypting GITHUB_TOKEN...");
  
  if (!process.env.GITHUB_TOKEN) throw Error("Missing GITHUB_TOKEN in .env");
  
  const secretsObject = { 
    githubToken: process.env.GITHUB_TOKEN 
  };

  // Extract the specific 'encryptedSecrets' string from the response object
  const encryptedSecretsResponse = await secretsManager.encryptSecrets(secretsObject);
  
  if (!encryptedSecretsResponse || !encryptedSecretsResponse.encryptedSecrets) {
    throw new Error("Encryption failed: No encrypted secrets returned.");
  }

  console.log("   ✅ Secrets encrypted successfully");
  console.log("\n📤 Uploading to Chainlink DON (This might take a moment)...");

  const {
    version,
  } = await secretsManager.uploadEncryptedSecretsToDON({
    encryptedSecretsHexstring: encryptedSecretsResponse.encryptedSecrets,
    gatewayUrls: gatewayUrls,
    slotId: 0,
    minutesUntilExpiration: 60 * 24 * 3, // 3 Days (72 hours max on testnet)
  });

  console.log("\n✅ Success! Secrets uploaded to DON.");
  console.log("=====================================");
  console.log(`Slot ID: 0`);
  console.log(`Version: ${version}`);
  console.log(`DON ID: ${donId}`);
  console.log(`Expiration: 3 days (72 hours)`);
  console.log("=====================================");
  console.log("\n💡 Next Steps:");
  console.log("   Pass these values to your verifyContribution() function:");
  console.log(`   - slotId: 0`);
  console.log(`   - version: ${version}`);
}

uploadSecrets().catch((err) => {
  console.error("\n❌ Failed to upload secrets:", err.message);
  
  if (err.stack) {
    console.error("\nStack trace:");
    console.error(err.stack);
  }
  
  // Specific hints for common issues
  console.error("\n⚠️  TROUBLESHOOTING TIPS:");
  console.error("1. Verify your PRIVATE_KEY and GITHUB_TOKEN are set in .env");
  console.error("2. Ensure your wallet has Sepolia ETH (check on https://sepolia.etherscan.io)");
  console.error("3. If on University/Corporate WiFi, try a Mobile Hotspot");
  console.error("4. Check RPC connection: curl https://rpc.sepolia.org");
  console.error("5. Verify Ethers version: npm list ethers (should be 5.7.2)");
  
  process.exit(1);
});