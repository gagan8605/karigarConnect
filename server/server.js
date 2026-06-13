// server/server.js
// UPDATED: Added /api/admin/complaints route for client-against-worker complaint management
// All original code preserved exactly.

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');
const fs       = require('fs');
const axios    = require('axios');
const cron     = require('node-cron');

// Load server/.env before any module config reads process.env.
dotenv.config({ path: path.join(__dirname, '.env') });

const { cloudinary } = require('./utils/cloudinary');
const { runWeeklyUpdate } = require('./cron/updateRates');

const authRoutes                 = require('./routes/authRoutes');
const adminRoutes                = require('./routes/adminRoutes');
const workerRoutes               = require('./routes/workerRoutes');
const clientRoutes               = require('./routes/clientRoutes');
const aiRoutes                   = require('./routes/aiRoutes');
const groupRoutes                = require('./routes/groupRoutes');
const jobRoutes                  = require('./routes/jobRoutes');
const adminFraudRoutes           = require('./routes/adminFraudRoutes');
const ivrRoutes                  = require('./routes/ivrRoutes');
const clientComplaintRoutes      = require('./routes/clientComplaintRoutes');
const adminComplaintRoutes       = require('./routes/adminComplaintRoutes');       // ← NEW: client-vs-worker complaints (ClientComplaint model)
const adminWorkerComplaintRoutes = require('./routes/adminWorkerComplaintRoutes'); // ← existing: worker support tickets (Complaint model)
const workerComplaintRoutes      = require('./routes/workerComplaintRoutes');
const communityRoutes            = require('./routes/communityRoutes');
const adminCommunityRoutes       = require('./routes/adminCommunityRoutes');
const locationRoutes             = require('./routes/locationRoutes');
const semanticMatchingRoutes     = require('./routes/semanticMatchingRoutes');
const chatbotRoutes              = require('./routes/chatbotRoutes');
const chatbotSupportRoutes       = require('./routes/chatbotSupportRoutes');
const { rebuildAllIndexes }      = require('./services/semanticMatchingService');
const { ensureAdminAccounts }    = require('./utils/adminAccounts');
const { sweepDirectHirePayments } = require('./controllers/directHireController');

// ── Shop & Coupon routes ──────────────────────────────────────────────────────
const shopRoutes       = require('./routes/shopRoutes');
const adminShopRoutes  = require('./routes/adminShopRoutes');
const couponRoutes     = require('./routes/couponRoutes');

// ── Payment & Razorpay routes ─────────────────────────────────────────────────
const paymentRoutes    = require('./routes/paymentRoutes');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const envOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const defaultDevOrigins = ['http://localhost:5173', 'http://192.168.0.101:5173'];
const allowedOrigins = Array.from(new Set([
    ...(envOrigins.length ? envOrigins : defaultDevOrigins),
    ...(process.env.NODE_ENV !== 'production' ? defaultDevOrigins : []),
]));

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS policy: Origin ${origin} is not allowed`));
    },
    credentials: true,
}));

// ── Static files ──────────────────────────────────────────────────────────────
// Serve the ENTIRE uploads/ directory at /uploads.
const uploadsRoot = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsRoot)) {
    fs.mkdirSync(uploadsRoot, { recursive: true });
    console.log('📁  Created uploads/ directory');
}

// Legacy specific subdirectory mounts kept for backward compatibility
const legacyStaticDirs = [
    { url: '/uploads/photos',    dir: 'uploads/photos'    },
    { url: '/uploads/ai',        dir: 'uploads/ai'        },
    { url: '/uploads/clients',   dir: 'uploads/clients'   },
    { url: '/uploads/community', dir: 'uploads/community' },
];
legacyStaticDirs.forEach(({ url, dir }) => {
    const abs = path.join(__dirname, dir);
    if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
    app.use(url, express.static(abs));
});

const escapeCloudinaryTerm = (value = '') => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const resolveLegacyFileFromCloudinary = async (fileName) => {
    const safeName = String(fileName || '').trim();
    if (!safeName) return null;

    let decoded = safeName;
    try {
        decoded = decodeURIComponent(safeName);
    } catch {
        decoded = safeName;
    }
    const ext = path.extname(decoded).toLowerCase();
    const base = decoded.replace(/\.[^/.]+$/, '');

    const folders = ['karigarconnect/misc', 'karigarconnect/documents', 'karigarconnect/worker-docs'];
    const resourceTypes = ext === '.pdf' ? ['raw', 'image'] : ['image', 'raw'];

    // 1) Direct public_id attempts for common legacy patterns
    for (const folder of folders) {
        const publicIdCandidates = [
            `${folder}/${base}`,
            `${folder}/${decoded}`,
        ];

        for (const publicId of publicIdCandidates) {
            for (const resourceType of resourceTypes) {
                try {
                    const asset = await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'upload' });
                    if (asset?.secure_url) return asset.secure_url;
                } catch {
                    // Continue searching.
                }
            }
        }
    }

    // 2) Search by filename within known folders (covers timestamped public IDs)
    const escapedBase = escapeCloudinaryTerm(base);
    for (const folder of folders) {
        const escapedFolder = escapeCloudinaryTerm(folder);
        try {
            const result = await cloudinary.search
                .expression(`folder="${escapedFolder}" AND filename="${escapedBase}"`)
                .sort_by('created_at', 'desc')
                .max_results(1)
                .execute();

            const secureUrl = result?.resources?.[0]?.secure_url;
            if (secureUrl) return secureUrl;
        } catch {
            // Continue searching.
        }
    }

    // 3) Global fallback by filename regardless of folder (for historical storage paths)
    try {
        const globalResult = await cloudinary.search
            .expression(`filename="${escapedBase}"`)
            .sort_by('created_at', 'desc')
            .max_results(1)
            .execute();

        const secureUrl = globalResult?.resources?.[0]?.secure_url;
        if (secureUrl) return secureUrl;
    } catch {
        // No global match.
    }

    return null;
};

// Backward compatibility for older DB paths like /uploads/documents/<file>
// that may now physically exist in /uploads/ or legacy subfolders.
app.get(/^\/uploads\/(documents|document|certificates|certificate)\/(.+)$/i, async (req, res, next) => {
    const legacyFolder = String(req.params?.[0] || '').toLowerCase();
    const fileName = path.basename(String(req.params?.[1] || ''));
    if (!fileName) return next();

    const candidates = [
        path.join(uploadsRoot, legacyFolder, fileName),
        path.join(uploadsRoot, fileName),
        path.join(uploadsRoot, 'photos', fileName),
        path.join(uploadsRoot, 'clients', fileName),
        path.join(uploadsRoot, 'community', fileName),
    ];

    const found = candidates.find((p) => fs.existsSync(p));
    if (found) return res.sendFile(found);

    try {
        const cloudUrl = await resolveLegacyFileFromCloudinary(fileName);
        if (cloudUrl) return res.redirect(cloudUrl);
    } catch {
        // Fall through to default 404 handler.
    }

    return next();
});

app.use('/uploads', express.static(uploadsRoot, { maxAge: '1d', index: false }));
console.log('📂  Serving static files from:', uploadsRoot);

// ── Database ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅  MongoDB connected');
        try {
            const admins = await ensureAdminAccounts();
            console.log(`✅  Admin accounts ready: ${admins.length}`);
        } catch (err) {
            console.error('❌  Failed to initialize admin accounts:', err.message);
        }
    })
    .catch(err => { console.error('❌  MongoDB connection failed:', err.message); process.exit(1); });

// ── Routes — specific paths BEFORE their parent prefix ────────────────────────
app.use('/api/auth',                     authRoutes);

app.use('/api/admin/fraud',              adminFraudRoutes);
app.use('/api/admin/fraud-notify',       adminFraudRoutes);
app.use('/api/admin/complaints',         adminComplaintRoutes);       // ← NEW: client-vs-worker complaints
app.use('/api/admin/worker-complaints',  adminWorkerComplaintRoutes); // ← existing: worker support tickets
app.use('/api/admin/community',          adminCommunityRoutes);
app.use('/api/admin/shops',              adminShopRoutes);
app.use('/api/admin',                    adminRoutes);

app.use('/api/client/complaints',        clientComplaintRoutes);
app.use('/api/client/payment',           paymentRoutes);
app.use('/api/client',                   clientRoutes);

app.use('/api/worker/complaints',        workerComplaintRoutes);
app.use('/api/worker/coupons',           couponRoutes);
app.use('/api/worker',                   workerRoutes);

app.use('/api/shop',                     shopRoutes);
app.use('/api/community',                communityRoutes);
app.use('/api/ai',                       aiRoutes);
app.use('/api/groups',                   groupRoutes);
app.use('/api/jobs',                     jobRoutes);
app.use('/api/ivr',                      ivrRoutes);
app.use('/api/location',                 locationRoutes);
app.use('/api/matching',                 semanticMatchingRoutes);
app.use('/api/chatbot',                  chatbotRoutes);
app.use('/api/chatbot/support',          chatbotSupportRoutes);

// ── Health checks ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: '🚀 KarigarConnect API', version: '2.5.0' }));
app.get('/api/health', (req, res) => res.json({
    status: 'ok', uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
}));

app.get('/api/fraud/health', async (req, res) => {
    try {
        const fraudUrl = process.env.FRAUD_SERVICE_URL || 'http://127.0.0.1:5001';
        const { data } = await axios.get(`${fraudUrl}/health`, { timeout: 5000 });
        return res.json({ status: 'ok', service: data });
    } catch (error) {
        return res.status(503).json({ status: 'degraded', message: 'Fraud service unavailable.', error: error.response?.data?.error || error.message });
    }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    const error = err || new Error('Unknown error');
    const errorMessage = error.message || String(error);
    console.error('Global error handler:', errorMessage);
    if (error.code === 'LIMIT_FILE_SIZE')        return res.status(413).json({ message: 'File too large. Maximum 5 MB.' });
    if (error.code === 'LIMIT_UNEXPECTED_FILE')  return res.status(400).json({ message: `Unexpected file field: ${error.field}` });
    if (errorMessage.includes('Only image'))     return res.status(400).json({ message: errorMessage });
    if (errorMessage.includes('Invalid file'))   return res.status(400).json({ message: errorMessage });
    if (errorMessage.includes('CORS'))           return res.status(403).json({ message: errorMessage });
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors || {}).map(e => e.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue || {})[0] || 'field';
        return res.status(409).json({ message: `Duplicate value for ${field}.` });
    }
    if (error.name === 'JsonWebTokenError')  return res.status(401).json({ message: 'Invalid token.' });
    if (error.name === 'TokenExpiredError')  return res.status(401).json({ message: 'Token expired. Please log in again.' });
    return res.status(error.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : errorMessage,
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 5000;
const HOST   = process.env.HOST || '0.0.0.0';

const shouldRebuildSemanticOnStartup = () => {
    const forceRebuild = String(process.env.FORCE_SEMANTIC_REBUILD_ON_STARTUP || '').toLowerCase() === 'true';
    if (forceRebuild) return true;

    const skipRebuild = String(process.env.SKIP_SEMANTIC_REBUILD_ON_STARTUP || '').toLowerCase() === 'true';
    if (skipRebuild) return false;

    // Nodemon restarts on file writes; rebuilding indexes writes index files and can create a restart loop.
    return process.env.NODEMON !== 'true';
};

const shouldRunPricingCron = () => {
    const disable = String(process.env.DISABLE_PRICING_CRON || '').toLowerCase() === 'true';
    return !disable;
};

const shouldRunDirectHireSweep = () => String(process.env.DISABLE_DIRECT_HIRE_SWEEP || '').toLowerCase() !== 'true';

const server = app.listen(PORT, HOST, () => {
    console.log(`🚀  Server running on port ${PORT}`);

    // ℹ️  Pricing engine cron has been DISABLED (2024-11-27)
    // Reason: Transitioned from automatic weekly updates to manual-only with cooldown
    // Admins now trigger market rate updates manually via POST /api/admin/rates/update-market-manual
    // with a 6-day cooldown between updates.
    // Base rates can be imported via CSV upload at POST /api/admin/rates/import-base-csv
    // (limited to once per week).
    // To re-enable auto-cron for testing, set DISABLE_PRICING_CRON=false
    if (shouldRunPricingCron()) {
        console.log('ℹ️   Pricing engine auto-cron is currently disabled. Use manual trigger via admin API instead.');
    } else {
        console.log('ℹ️   Pricing engine cron disabled by DISABLE_PRICING_CRON=true');
    }

    if (shouldRunDirectHireSweep()) {
        setInterval(() => {
            sweepDirectHirePayments().catch((err) => {
                console.error('❌  Direct hire payment sweep failed:', err.message);
            });
        }, 10 * 60 * 1000);
        console.log('✅  Direct hire payment sweep scheduled: every 10 minutes');
    } else {
        console.log('ℹ️   Direct hire payment sweep disabled by DISABLE_DIRECT_HIRE_SWEEP=true');
    }

    // Auto-rebuild semantic index on startup (non-blocking)
    if (!shouldRebuildSemanticOnStartup()) {
        console.log('ℹ️   Semantic startup rebuild skipped (nodemon detected or disabled by env).');
        return;
    }

    setImmediate(async () => {
        try {
            const result = await rebuildAllIndexes();
            console.log(`✅  Semantic index rebuilt on startup: ${result.workersIndexed} workers, ${result.jobsIndexed} jobs indexed`);
        } catch (err) {
            console.error('⚠️   Failed to rebuild semantic index on startup:', err.message);
        }
    });
});

process.on('SIGTERM', () => { server.close(async () => { await mongoose.connection.close().catch(console.error); process.exit(0); }); });
process.on('SIGINT',  () => { server.close(async () => { await mongoose.connection.close().catch(console.error); process.exit(0); }); });
