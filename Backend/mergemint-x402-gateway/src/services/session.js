const { ethers } = require('ethers');
const { TOKEN_EXPIRY_SECONDS } = require('../config/constants');

class SessionService {
    constructor() {
        // In-memory storage (use Redis in production)
        this.sessions = new Map();

        // Clean up expired sessions every 5 minutes
        setInterval(() => this.cleanupExpiredSessions(), 300000);
    }

    /**
     * Creates a new session with an access token
     * @param {string} issueId 
     * @param {string} signerAddress 
     * @returns {Object} - Session data including token
     */
    createSession(issueId, signerAddress) {
        // Generate cryptographically secure random token
        const accessToken = ethers.hexlify(ethers.randomBytes(32));

        const session = {
            issueId,
            signer: signerAddress,
            createdAt: Date.now(),
            expiresAt: Date.now() + (TOKEN_EXPIRY_SECONDS * 1000)
        };

        this.sessions.set(accessToken, session);

        return {
            accessToken,
            expiresIn: TOKEN_EXPIRY_SECONDS,
            session
        };
    }

    /**
     * Validates an access token
     * @param {string} token 
     * @returns {Object|null} - Session data or null if invalid
     */
    validateToken(token) {
        if (!token) {
            return null;
        }

        const session = this.sessions.get(token);

        if (!session) {
            return null;
        }

        // Check if token has expired
        if (Date.now() > session.expiresAt) {
            this.sessions.delete(token);
            return null;
        }

        return session;
    }

    /**
     * Revokes a token
     * @param {string} token 
     */
    revokeToken(token) {
        this.sessions.delete(token);
    }

    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleaned = 0;

        for (const [token, session] of this.sessions.entries()) {
            if (session.expiresAt < now) {
                this.sessions.delete(token);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
        }
    }

    /**
     * Get session statistics
     */
    getStats() {
        return {
            totalSessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values())
                .filter(s => s.expiresAt > Date.now()).length
        };
    }
}

module.exports = new SessionService();