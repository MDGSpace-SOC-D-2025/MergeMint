const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { PORT, NODE_ENV, ALLOWED_ORIGINS } = require('./config/constants');
const paymentRoutes = require('./routes/payment');
const contextRoutes = require('./routes/context');
const sessionService = require('./services/session');

// Initialize Express app
const app = express();

// ===== Middleware =====

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: ALLOWED_ORIGINS === '*' ? '*' : ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Payment-Token']
}));

// Body parser
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
    }
});

app.use('/api/', limiter);

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ===== Routes =====

// Health check endpoint
app.get('/health', (req, res) => {
    const stats = sessionService.getStats();
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sessions: stats
    });
});

// API routes
app.use('/api/v1/payment', paymentRoutes);
app.use('/api/v1/context', contextRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ===== Start Server =====

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('🚀 MergeMint x402 Gateway Server');
    console.log('═══════════════════════════════════════════');
    console.log(`Environment: ${NODE_ENV}`);
    console.log(`Port: ${PORT}`);
    console.log(`Recipient: ${process.env.RECIPIENT_ADDRESS}`);
    console.log(`Chain ID: ${process.env.CHAIN_ID}`);
    console.log(`Payment Amount: ${process.env.PAYMENT_AMOUNT} (0.${parseInt(process.env.PAYMENT_AMOUNT) / 10000} USDC)`);
    console.log('═══════════════════════════════════════════');
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log('═══════════════════════════════════════════\n');
});

module.exports = app;