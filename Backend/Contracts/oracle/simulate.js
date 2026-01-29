const { simulateScript } = require("@chainlink/functions-toolkit");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function runSimulation() {
  // Read the source code from verification.js
  const source = fs.readFileSync(path.resolve(__dirname, "verification.js")).toString();

  // Define Test Cases
  // args: [Owner, Repo, PR_Number, Target_Issue_ID]
  // Note: Update these with REAL data from your public repo to verify actual logic
  const testCases = [
    {
      name: "Valid PR",
      args: ["vihaan1016", "MergeMint-Test", "2", "1"], 
      expectedSuccess: true
    },
    {
      name: "Unmerged PR",
      args: ["vihaan1016", "MergeMint-Test", "4", "3"], 
      expectedSuccess: false
    },
    {
      name: "Malicious PR",
      args: ["vihaan1016", "MergeMint-Test", "7", "5"], 
      expectedSuccess: false
    }
  ];

  console.log("🚀 Starting Chainlink Functions Local Simulation...\n");

  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ Error: GITHUB_TOKEN is missing in .env file");
    return;
  }

  for (const test of testCases) {
    console.log(`\nTesting Case: ${test.name}`);
    console.log(`Arguments: ${JSON.stringify(test.args)}`);

    try {
      const { responseBytesHexstring, errorString, capturedTerminalOutput } = await simulateScript({
        source: source,
        args: test.args,
        bytesArgs: [],
        secrets: { githubToken: process.env.GITHUB_TOKEN },
      });

      if (errorString) {
        console.error(`❌ Script Failed: ${errorString}`);
        console.log("Logs:", capturedTerminalOutput);
        continue;
      }

      if (responseBytesHexstring) {
        // Universal Decoder (Supports both Ethers v5 and v6)
        let decoded;
        
        if (ethers.utils && ethers.utils.defaultAbiCoder) {
           // Ethers v5 Syntax
           decoded = ethers.utils.defaultAbiCoder.decode(
            ["bool", "string"],
            responseBytesHexstring
          );
        } else {
           // Ethers v6 Syntax
           decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["bool", "string"],
            responseBytesHexstring
          );
        }

        const [success, author] = decoded;
        const passed = success === test.expectedSuccess;

        console.log(`\n🔍 Oracle Output:`);
        console.log(`   - Verified: ${success}`);
        console.log(`   - Author: "${author}"`);
        console.log(`\n${passed ? "✅ TEST PASSED" : "❌ TEST FAILED"}`);
        
        if (!passed) {
             console.log(`   Expected verified to be ${test.expectedSuccess} but got ${success}`);
        }
      }

    } catch (err) {
      console.error("❌ Simulation Error:", err);
    }
    console.log("-".repeat(50));
  }
}

runSimulation();