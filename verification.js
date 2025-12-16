// This script runs on the Chainlink Decentralized Oracle Network (DON)
// Inputs: 
// args[0]: Repository Owner (e.g., "vihaan1016")
// args[1]: Repository Name (e.g., "MergeMint")
// args[2]: PR Number (e.g., "42")
// args[3]: Issue ID to check against (e.g., "101")

// Checking if the number of argunents is correct
if (!args || args.length < 4) {
  throw new Error("Missing required arguments");
}
const owner = args[0];
const repo = args[1];
const prNumber = parseInt(args[2]);
const targetIssueId = args[3];

// Define the GraphQL Query
// Fetching only nnecerssary fields for verification
const query = `
query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      merged
      mergedAt
      body
      author {
        login
      }
    }
  }
}`;

// 2. Make the Request
// Using the globally available Functions object
const response = await Functions.makeHttpRequest({
  url: "https://api.github.com/graphql",
  method: "POST",
  headers: {
    "Authorization": `Bearer ${secrets.githubToken}`,
    "Content-Type": "application/json"
  },
  data: {
    query: query,
    variables: { owner, name: repo, number: prNumber }
  }
});

if (response.error) {
  throw Error(`GitHub API Request Failed: ${JSON.stringify(response)}`);
}

// Sample Response Structure:
// {
//   "response" (The main object variable)
//   "status": 200,
//   "statusText": "OK",
//   "data": { // "response.data" (The HTTP body)
//     "data": { // "response.data.data" (The GraphQL root)
//       "repository": { // "response.data.data.repository"
//         "pullRequest": { // "response.data.data.repository.pullRequest" (<-- prData)
//           "id": "PR",
//           "number": 42,
//           "title": "Fix Issue #10: Add Funding Logic",
//           "state": "MERGED",
//           "merged": true,
//           "author": {
//             "login": "bountyHunter69"
//           }
//         }
//       }
//     }
//   }
// }
const prData = response.data.data.repository.pullRequest;

if (!prData) {
  throw Error("Pull Request not found");
}

// Verification Logic 

// Check 1: Is it actually merged?
const isMerged = prData.merged;

// Check 2: Regex Validation for "Closes #101"
const bodyText = prData.body || "";
const regex = new RegExp(`(closes|fixes|resolves)\\s+#${targetIssueId}`, "i");
const isValidLink = regex.test(bodyText);

// 4. Construct Result
const verificationPassed = isMerged && isValidLink;
const author = prData.author.login;

console.log(`Verification: ${verificationPassed} (Merged: ${isMerged}, Linked: ${isValidLink})`);
console.log(`Author: ${author}`);

// Manual ABI Encoding (Gas Efficient & No external dependencies)
// We need to return ABI encoded: (bool, string)
// Layout:
// - Bool (32 bytes)
// - Offset to String (32 bytes) -> always 64 (0x40) for this specific tuple
// - String Length (32 bytes)
// - String Data (padded to 32 byte chunks)

function encodeAbi(boolValue, stringValue) {
  // A. Encode Bool
  const boolBuf = new Uint8Array(32);
  boolBuf[31] = boolValue ? 1 : 0;

  // B. Encode String
  const encoder = new TextEncoder();
  const stringBytes = encoder.encode(stringValue);
  const len = stringBytes.length;
  
  // Encode Length (uint256)
  const lenBuf = new Uint8Array(32);
  let lenTemp = len;
  for (let i = 31; i >= 0; i--) {
    lenBuf[i] = lenTemp & 0xff;
    lenTemp >>= 8;
  }

  // Pad String Data to 32 bytes
  const paddedLen = Math.ceil(len / 32) * 32;
  const strBuf = new Uint8Array(paddedLen);
  strBuf.set(stringBytes);

  // C. Encode Offset (uint256) -> 64 bytes
  // Why 64? Because the "Head" is Bool(32) + Offset(32) = 64
  const offsetBuf = new Uint8Array(32);
  offsetBuf[31] = 64; 

  // D. Combine All
  const totalLen = 32 + 32 + 32 + paddedLen;
  const result = new Uint8Array(totalLen);
  
  result.set(boolBuf, 0);       // 0-31: Bool
  result.set(offsetBuf, 32);    // 32-63: Offset
  result.set(lenBuf, 64);       // 64-95: String Length
  result.set(strBuf, 96);       // 96-End: String Data
  
  return result;
}

const encoded = encodeAbi(verificationPassed, author);
return encoded;