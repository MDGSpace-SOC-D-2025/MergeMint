const { ethers } = require('ethers');
const { EIP712_DOMAIN, EIP712_TYPES, SIGNATURE_EXPIRY_SECONDS } = require('../config/constants');

class SignatureService {
    /**
     * Verifies an EIP-712 signature
     * @param {Object} paymentData - The payment data that was signed
     * @param {string} signature - The signature to verify
     * @returns {string} - The recovered signer address
     */
    verifySignature(paymentData, signature) {
        try {
            // Reconstruct the EIP-712 hash
            const digest = ethers.TypedDataEncoder.hash(
                EIP712_DOMAIN,
                EIP712_TYPES,
                paymentData
            );

            const signerAddress = ethers.recoverAddress(digest, signature);

            return signerAddress;
        } catch (error) {
            throw new Error(`Signature verification failed: ${error.message}`);
        }
    }

    /**
     * Validates payment data business rules
     * @param {Object} paymentData 
     * @param {string} expectedAmount 
     * @param {string} expectedRecipient 
     */
    validatePaymentData(paymentData, expectedAmount, expectedRecipient) {
        const now = Date.now();

        // Check if signature has expired
        if (now > paymentData.deadline) {
            throw new Error('Signature expired');
        }

        // Check if signature is too old (not yet valid)
        const age = now - paymentData.nonce;
        if (age > SIGNATURE_EXPIRY_SECONDS * 1000) {
            throw new Error('Signature too old');
        }

        // Verify amount matches
        if (paymentData.amount !== expectedAmount) {
            throw new Error(`Invalid amount. Expected ${expectedAmount}, got ${paymentData.amount}`);
        }

        // Verify recipient matches
        if (paymentData.recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
            throw new Error('Invalid recipient address');
        }

        return true;
    }

    /**
     * Creates a payment challenge for the client
     * @param {string} issueId 
     * @returns {Object} - The payment challenge
     */
    createPaymentChallenge(issueId, amount, recipient) {
        const nonce = Date.now();
        const deadline = nonce + (SIGNATURE_EXPIRY_SECONDS * 1000);

        return {
            payment: {
                amount,
                currency: 'USDC',
                chainId: EIP712_DOMAIN.chainId,
                recipient,
                nonce,
                deadline
            },
            eip712: {
                domain: EIP712_DOMAIN,
                types: EIP712_TYPES,
                message: {
                    issueId,
                    amount,
                    recipient,
                    nonce,
                    deadline
                }
            }
        };
    }
}

module.exports = new SignatureService();