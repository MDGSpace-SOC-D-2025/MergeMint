const express = require('express');
const router = express.Router();
const signatureService = require('../services/signature');
const sessionService = require('../services/session');
const { PAYMENT_AMOUNT, RECIPIENT_ADDRESS } = require('../config/constants');

/**
 * POST /api/v1/payment/verify
 * Verifies a payment signature and issues an access token
 */
router.post('/verify', async (req, res) => {
    try {
        const { paymentData, signature } = req.body;

        // Validate request body
        if (!paymentData || !signature) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing paymentData or signature'
            });
        }

        // Validate payment data business rules
        signatureService.validatePaymentData(
            paymentData,
            PAYMENT_AMOUNT,
            RECIPIENT_ADDRESS
        );

        // Verify the cryptographic signature
        const signerAddress = signatureService.verifySignature(paymentData, signature);

        console.log(`✅ Valid signature from ${signerAddress} for issue ${paymentData.issueId}`);

        // Create session and issue access token
        const { accessToken, expiresIn } = sessionService.createSession(
            paymentData.issueId,
            signerAddress
        );

        res.json({
            success: true,
            accessToken,
            expiresIn,
            message: 'Payment verified. Use token in X-Payment-Token header'
        });

    } catch (error) {
        console.error('❌ Payment verification failed:', error.message);

        res.status(400).json({
            error: 'Payment Verification Failed',
            message: error.message
        });
    }
});

module.exports = router;