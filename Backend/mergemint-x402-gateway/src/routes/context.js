const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const signatureService = require('../services/signature');
const sessionService = require('../services/session');
const { PAYMENT_AMOUNT, RECIPIENT_ADDRESS } = require('../config/constants');

/**
 * GET /api/v1/context/:owner/:repo/:issueId
 * Returns context data if payment token is valid, otherwise returns 402
 */
router.get('/:owner/:repo/:issueId', async (req, res) => {
    const { owner, repo, issueId } = req.params;
    const token = req.headers['x-payment-token'];

    // Check if client has provided a payment token
    if (!token) {
        return send402Response(res, issueId);
    }

    // Validate the token
    const session = sessionService.validateToken(token);

    if (!session) {
        return res.status(401).json({
            error: 'Invalid Token',
            message: 'Token not found, expired, or malformed. Please obtain a new payment token.'
        });
    }

    // Verify token is for the correct issue
    if (session.issueId !== issueId) {
        return res.status(403).json({
            error: 'Token Mismatch',
            message: `This token is for issue ${session.issueId}, not ${issueId}`
        });
    }

    // Token is valid - serve the context
    try {
        const contextData = await loadContext(owner, repo, issueId);

        console.log(`📤 Serving context ${owner}/${repo}/${issueId} to ${session.signer}`);

        res.json({
            success: true,
            context: contextData,
            metadata: {
                owner,
                repo,
                issueId,
                accessedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                error: 'Context Not Found',
                message: `No context data exists for ${owner}/${repo}/${issueId}`
            });
        }

        console.error('Error loading context:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to load context data'
        });
    }
});

/**
 * Sends a 402 Payment Required response with payment challenge
 */
function send402Response(res, issueId) {
    const challenge = signatureService.createPaymentChallenge(
        issueId,
        PAYMENT_AMOUNT,
        RECIPIENT_ADDRESS
    );

    res.status(402).json({
        error: 'Payment Required',
        message: 'This context requires payment to access',
        ...challenge
    });
}

/**
 * Loads context data from the file system
 */
async function loadContext(owner, repo, issueId) {
    const contextPath = path.join(
        __dirname,
        '../../data/contexts',
        `${owner}_${repo}_${issueId}.json`
    );

    const data = await fs.readFile(contextPath, 'utf8');
    return JSON.parse(data);
}

module.exports = router;