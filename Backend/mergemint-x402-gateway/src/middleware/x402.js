const signatureService = require('../services/signature');
const sessionService = require('../services/session');
const { PAYMENT_AMOUNT, RECIPIENT_ADDRESS } = require('../config/constants');

/**
 * x402 Payment Middleware
 * 
 * This middleware automatically enforces payment requirements on protected routes.
 * It checks for valid payment tokens and returns 402 if payment is required.
 * 
 * Usage:
 *   router.get('/protected-route', x402Middleware, (req, res) => { ... });
 */

class X402Middleware {
    /**
     * Main middleware function
     * Validates payment tokens or returns 402 Payment Required
     */
    static protect(options = {}) {
        return (req, res, next) => {
            const token = req.headers['x-payment-token'];

            // Extract resource identifier (e.g., issueId from route params)
            const resourceId = X402Middleware.extractResourceId(req, options);

            if (!resourceId) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'Could not determine resource identifier'
                });
            }

            // Check if client has provided a payment token
            if (!token) {
                return X402Middleware.send402Response(res, resourceId, options);
            }

            // Validate the token
            const session = sessionService.validateToken(token);

            if (!session) {
                return res.status(401).json({
                    error: 'Invalid Token',
                    message: 'Token not found, expired, or malformed. Please obtain a new payment token.',
                    code: 'TOKEN_INVALID'
                });
            }

            // Verify token matches the requested resource
            if (session.issueId !== resourceId) {
                return res.status(403).json({
                    error: 'Token Mismatch',
                    message: `This token is for issue ${session.issueId}, not ${resourceId}`,
                    code: 'TOKEN_MISMATCH'
                });
            }

            // Token is valid - attach session to request for downstream use
            req.session = session;
            req.paymentVerified = true;

            console.log(`✅ Payment verified for ${resourceId} (signer: ${session.signer})`);

            next();
        };
    }

    /**
     * Extracts the resource identifier from the request
     * @param {Object} req - Express request object
     * @param {Object} options - Middleware options
     * @returns {string} - Resource identifier (e.g., issueId)
     */
    static extractResourceId(req, options) {
        // Option 1: Custom extractor function
        if (options.extractId && typeof options.extractId === 'function') {
            return options.extractId(req);
        }

        // Option 2: Specified parameter name
        if (options.idParam) {
            return req.params[options.idParam];
        }

        // Option 3: Default - look for common parameters
        return req.params.issueId ||
            req.params.id ||
            req.params.resourceId ||
            req.query.issueId ||
            req.query.id;
    }

    /**
     * Sends a 402 Payment Required response with payment challenge
     * @param {Object} res - Express response object
     * @param {string} resourceId - The resource being accessed
     * @param {Object} options - Middleware options
     */
    static send402Response(res, resourceId, options = {}) {
        const amount = options.amount || PAYMENT_AMOUNT;
        const recipient = options.recipient || RECIPIENT_ADDRESS;

        const challenge = signatureService.createPaymentChallenge(
            resourceId,
            amount,
            recipient
        );

        console.log(`402 Payment Required for resource: ${resourceId}`);

        res.status(402).json({
            error: 'Payment Required',
            message: options.message || 'This resource requires payment to access',
            code: 'PAYMENT_REQUIRED',
            ...challenge
        });
    }

    /**
     * Optional authentication middleware
     * Verifies token but doesn't enforce payment (useful for optional premium features)
     */
    static optional(options = {}) {
        return (req, res, next) => {
            const token = req.headers['x-payment-token'];

            if (!token) {
                req.paymentVerified = false;
                return next();
            }

            const session = sessionService.validateToken(token);

            if (session) {
                req.session = session;
                req.paymentVerified = true;
                console.log(`✅ Optional payment verified (signer: ${session.signer})`);
            } else {
                req.paymentVerified = false;
            }

            next();
        };
    }

    /**
     * Rate limiting middleware for paid access
     * Allows more requests for paying users
     */
    static rateLimit(options = {}) {
        const freeLimit = options.freeLimit || 10;
        const paidLimit = options.paidLimit || 100;
        const windowMs = options.windowMs || 60000; // 1 minute

        const requestCounts = new Map();

        // Clean up old entries every minute
        setInterval(() => {
            const now = Date.now();
            for (const [key, data] of requestCounts.entries()) {
                if (now - data.windowStart > windowMs) {
                    requestCounts.delete(key);
                }
            }
        }, windowMs);

        return (req, res, next) => {
            const isPaid = req.paymentVerified === true;
            const limit = isPaid ? paidLimit : freeLimit;
            const identifier = isPaid ? req.session.signer : req.ip;

            const now = Date.now();
            const data = requestCounts.get(identifier) || { count: 0, windowStart: now };

            // Reset if window has passed
            if (now - data.windowStart > windowMs) {
                data.count = 0;
                data.windowStart = now;
            }

            data.count++;
            requestCounts.set(identifier, data);

            if (data.count > limit) {
                return res.status(429).json({
                    error: 'Rate Limit Exceeded',
                    message: isPaid
                        ? `You have exceeded the rate limit of ${paidLimit} requests per minute`
                        : `Free tier limit of ${freeLimit} requests per minute exceeded. Authenticate for higher limits.`,
                    code: 'RATE_LIMIT_EXCEEDED',
                    limit,
                    remaining: 0,
                    resetAt: new Date(data.windowStart + windowMs).toISOString()
                });
            }

            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', limit);
            res.setHeader('X-RateLimit-Remaining', limit - data.count);
            res.setHeader('X-RateLimit-Reset', new Date(data.windowStart + windowMs).toISOString());

            next();
        };
    }

    /**
     * Middleware to log payment analytics
     */
    static analytics(options = {}) {
        return (req, res, next) => {
            if (req.paymentVerified) {
                const session = req.session;
                const resourceId = X402Middleware.extractResourceId(req, options);

                // Log analytics data
                console.log('Payment Analytics:', {
                    timestamp: new Date().toISOString(),
                    signer: session.signer,
                    resource: resourceId,
                    endpoint: req.path,
                    method: req.method
                });

                // You could send this to your analytics service
                // analytics.track('resource_accessed', { ... });
            }

            next();
        };
    }

    /**
     * Middleware to check if user has sufficient balance (optional on-chain check)
     * This would require additional setup with a provider
     */
    static checkBalance(options = {}) {
        return async (req, res, next) => {
            if (!req.paymentVerified) {
                return next();
            }

            // This is a placeholder - we would implement actual balance checking
            // using ethers.js and a provider

            // const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
            // const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
            // const balance = await usdcContract.balanceOf(req.session.signer);

            // if (balance.lt(ethers.utils.parseUnits(PAYMENT_AMOUNT, 6))) {
            //   return res.status(402).json({
            //     error: 'Insufficient Balance',
            //     message: 'Your wallet does not have sufficient USDC balance'
            //   });
            // }

            next();
        };
    }
}

// Export the middleware class and common middleware functions
module.exports = {
    X402Middleware,

    // Convenience exports for common use cases
    protect: X402Middleware.protect,
    optional: X402Middleware.optional,
    rateLimit: X402Middleware.rateLimit,
    analytics: X402Middleware.analytics,
    checkBalance: X402Middleware.checkBalance
};