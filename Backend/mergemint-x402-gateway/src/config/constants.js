// constants:
// 1. eip-712 domain
// 2. eip-712 types
// 3. recepient address
// 4. chain id
// 5. rpc url
// 6. PORT
// 7. token expiry time 
// 8. signature expiry time
import dotenv from "dotenv";
dotenv.config();

module.exports = {

    // SERVER CONFIG
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,

    // PAYMENT CONFIG
    RECIPIENT_ADDRESS: process.env.RECIPIENT_ADDRESS,
    CHAIN_ID: process.env.CHAIN_ID,
    PAYMENT_AMOUNT: process.env.PAYMENT_AMOUNT,

    // TOKEN CONFIG
    TOKEN_EXPIRY_SECONDS: process.env.TOKEN_EXPIRY_SECONDS,
    SIGNATURE_EXPIRY_SECONDS: process.env.SIGNATURE_EXPIRY_SECONDS,


    // EIP-712 DOMAIN
    EIP712_DOMAIN: {
        name: "MergeMint",
        version: "1",
        chainId: parseInt(process.env.CHAIN_ID),
        verifyingContract: process.env.RECIPIENT_ADDRESS
    },

    // EIP-712 TYPES
    EIP712_TYPES: {
        Payment: [
            { name: 'issueId', type: 'string' },
            { name: 'amount', type: 'uint256' },
            { name: 'recipient', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
        ]
    },


};