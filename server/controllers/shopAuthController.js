// server/controllers/shopAuthController.js

const Shop = require('../models/shopModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpSms } = require('../utils/smsHelper');
const { sendEmailMessage, sendOtpEmail } = require('../utils/emailHelper');
const { getOtpCooldownState, markOtpCooldown, formatOtpCooldownMessage } = require('../utils/otpCooldown');
const { validateStrongPassword, PASSWORD_POLICY_TEXT } = require('../utils/passwordPolicy');

// ── JWT helper ────────────────────────────────────────────────────────────────
const signToken = (id) =>
    jwt.sign({ id, role: 'shop' }, process.env.JWT_SECRET, { expiresIn: '7d' });

// ── MEDIA PATH HELPERS ───────────────────────────────────────────────────────
// Cloudinary upload middleware returns a fully qualified URL in req.file.path.
// Keep that value as-is so updates and fetches resolve to the same Cloudinary URL.
const resolveMediaPath = (file) => file?.path || file?.secure_url || file?.url || null;

exports.sendMobileOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10)
            return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });

        // Check if shop is already registered or pending
        const existingShop = await Shop.findOne({ mobile });
        if (existingShop && (existingShop.ownerName || existingShop.verificationStatus === 'approved' || existingShop.verificationStatus === 'pending')) {
            return res.status(409).json({
                message: 'This mobile number is already registered or submitted for review. Please login instead.',
                alreadyRegistered: true
            });
        }

        const cooldownKey = `shop:mobile-otp:${mobile}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashed = crypto.createHash('sha256').update(otp).digest('hex');

        // Use find + save instead of upsert to bypass Mongoose required-field validators
        // (Mongoose 8.x runs validators on upsert inserts even with runValidators:false)
        let shopDoc = await Shop.findOne({ mobile });
        if (shopDoc) {
            shopDoc.mobileOtp       = hashed;
            shopDoc.mobileOtpExpiry = expiry;
            shopDoc.mobileVerified  = false;
            await shopDoc.save({ validateBeforeSave: false });
        } else {
            const newShop = new Shop({ mobile });
            newShop.mobileOtp       = hashed;
            newShop.mobileOtpExpiry = expiry;
            newShop.mobileVerified  = false;
            await newShop.save({ validateBeforeSave: false });
        }

        const smsResult = await sendOtpSms(mobile, otp);
        if (smsResult?.success === false) {
            // In production, treat SMS failure as a hard error
            if (process.env.NODE_ENV === 'production') {
                throw new Error(smsResult.reason || 'sms_send_failed');
            }
            // In development/trial, Twilio may reject unverified numbers — log and continue
            console.warn(`[sendMobileOtp] SMS not delivered (${smsResult.reason}). OTP saved in DB for dev testing.`);
        }

        markOtpCooldown(cooldownKey);
        const isDev = process.env.NODE_ENV !== 'production';
        return res.json({
            message: smsResult?.success === false && isDev
                ? 'OTP generated (SMS skipped in dev — Twilio trial limitation). Use DB/logs to get OTP.'
                : 'OTP sent to mobile.',
            ...(isDev && smsResult?.success === false ? { devOtp: otp } : {}),
        });
    } catch (err) {
        console.error('sendMobileOtp:', err);
        return res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── STEP 2: Send Email OTP ────────────────────────────────────────────────────
exports.sendEmailOtp = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const mobile = String(req.body?.mobile || '').trim();
        if (!email) return res.status(400).json({ message: 'Email required.' });

        // Check if shop is already registered with this email
        const existingShopByEmail = await Shop.findOne({ email });
        if (existingShopByEmail && (existingShopByEmail.ownerName || existingShopByEmail.verificationStatus === 'approved' || existingShopByEmail.verificationStatus === 'pending')) {
            return res.status(409).json({
                message: 'This email is already registered or submitted for review. Please login instead.',
                alreadyRegistered: true
            });
        }

        // Each identifier (email/mobile) has its own 30-second cooldown
        const cooldownKey = `shop:email-otp:${email}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashed = crypto.createHash('sha256').update(otp).digest('hex');

        // Upsert by email if mobile not provided, otherwise update by mobile
        if (mobile && mobile.length === 10) {
            await Shop.findOneAndUpdate(
                { mobile },
                { email, emailOtp: hashed, emailOtpExpiry: expiry, emailVerified: false },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } else {
            await Shop.findOneAndUpdate(
                { email },
                { email, emailOtp: hashed, emailOtpExpiry: expiry, emailVerified: false },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        // Send email OTP using optimized OTP send path
        try {
            const emailResult = await sendOtpEmail(email, otp);
            markOtpCooldown(cooldownKey);
            if (emailResult?.devFallback) {
                return res.json({
                    message: 'Email OTP bypassed in development because Brevo rejected the current IP.',
                    expiresAt: expiry.toISOString(),
                    devFallback: true,
                });
            }
            return res.json({
                message: 'OTP sent to email.',
                expiresAt: expiry.toISOString(),
            });
        } catch (emailErr) {
            console.error('[SHOP EMAIL OTP] Failed:', emailErr.message || emailErr);
            return res.status(500).json({ message: 'Failed to send email OTP. Please try again.' });
        }
    } catch (err) {
        console.error('sendEmailOtp:', err);
        return res.status(500).json({ message: 'Failed to send email OTP.' });
    }
};

// ── STEP 3: Verify Mobile OTP ─────────────────────────────────────────────────
exports.verifyMobileOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const shop = await Shop.findOne({ mobile }).select('+mobileOtp +mobileOtpExpiry');
        if (!shop || !shop.mobileOtp)
            return res.status(400).json({ message: 'No OTP request found.' });
        if (Date.now() > new Date(shop.mobileOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP expired. Request a new one.' });

        const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashed !== shop.mobileOtp)
            return res.status(400).json({ message: 'Incorrect OTP.' });

        shop.mobileVerified = true;
        shop.mobileOtp = undefined;
        shop.mobileOtpExpiry = undefined;
        await shop.save({ validateBeforeSave: false });
        return res.json({ message: 'Mobile verified.' });
    } catch (err) {
        console.error('verifyMobileOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── STEP 4: Verify Email OTP ──────────────────────────────────────────────────
exports.verifyEmailOtp = async (req, res) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        const mobile = String(req.body?.mobile || '').trim();
        const otp = String(req.body?.otp || '').trim();
        if (!otp || (!email && !mobile)) {
            return res.status(400).json({ message: 'Email or mobile and OTP are required.' });
        }

        const query = email ? { email } : { mobile };
        const shop = await Shop.findOne(query).select('+emailOtp +emailOtpExpiry');
        if (!shop || !shop.emailOtp)
            return res.status(400).json({ message: 'No email OTP found.' });
        if (Date.now() > new Date(shop.emailOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP expired.' });

        const hashed = crypto.createHash('sha256').update(otp).digest('hex');
        if (hashed !== shop.emailOtp)
            return res.status(400).json({ message: 'Incorrect OTP.' });

        shop.emailVerified = true;
        shop.emailOtp = undefined;
        shop.emailOtpExpiry = undefined;
        await shop.save({ validateBeforeSave: false });
        return res.json({ message: 'Email verified.' });
    } catch (err) {
        console.error('verifyEmailOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── LOGIN OTP: Send OTP for existing shops ────────────────────────────────────
exports.sendLoginOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10)
            return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });

        // Find existing shop
        const shop = await Shop.findOne({ mobile });
        if (!shop) {
            return res.status(404).json({
                message: 'This mobile number is not registered. Please register first.',
                notRegistered: true
            });
        }

        if (shop.verificationStatus === 'rejected' || shop.verificationStatus === 'blocked') {
            return res.status(403).json({
                message: `Your shop account is ${shop.verificationStatus}. Contact support.`,
                accountBlocked: true
            });
        }

        const cooldownKey = `shop:login-otp:${mobile}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        // Send OTP for login
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);
        const hashed = crypto.createHash('sha256').update(otp).digest('hex');

        shop.loginOtp = hashed;
        shop.loginOtpExpiry = expiry;
        await shop.save({ validateBeforeSave: false });

        const smsResult = await sendOtpSms(mobile, otp);
        if (smsResult?.success === false) {
            throw new Error(smsResult.reason || 'sms_send_failed');
        }

        markOtpCooldown(cooldownKey);
        return res.json({ message: 'OTP sent to mobile.' });
    } catch (err) {
        console.error('sendLoginOtp:', err);
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
};

// ── LOGIN OTP: Verify OTP for existing shops ──────────────────────────────────
exports.verifyLoginOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp)
            return res.status(400).json({ message: 'Mobile and OTP required.' });

        const shop = await Shop.findOne({ mobile }).select('+loginOtp +loginOtpExpiry');
        if (!shop || !shop.loginOtp)
            return res.status(400).json({ message: 'No OTP request found. Send OTP first.' });

        if (Date.now() > new Date(shop.loginOtpExpiry).getTime())
            return res.status(400).json({ message: 'OTP expired. Request a new one.' });

        const hashed = crypto.createHash('sha256').update(otp.trim()).digest('hex');
        if (hashed !== shop.loginOtp)
            return res.status(400).json({ message: 'Incorrect OTP.' });

        // Clear OTP fields
        shop.loginOtp = undefined;
        shop.loginOtpExpiry = undefined;
        await shop.save({ validateBeforeSave: false });

        // Prepare response
        const token = signToken(shop._id);
        const shopData = shop.toObject();
        delete shopData.password;
        delete shopData.mobileOtp;
        delete shopData.mobileOtpExpiry;
        delete shopData.emailOtp;
        delete shopData.emailOtpExpiry;
        delete shopData.loginOtp;
        delete shopData.loginOtpExpiry;

        return res.json({
            token,
            shop: shopData,
            message: 'Login successful!'
        });
    } catch (err) {
        console.error('verifyLoginOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── STEP 5: Complete Registration ─────────────────────────────────────────────
exports.registerShop = async (req, res) => {
    try {
        const {
            ownerName, mobile, email, password,
            shopName, gstNumber, category,
            address, city, pincode, locality, idType,
            latitude, longitude,
        } = req.body;

        if (!validateStrongPassword(password || '').isValid) {
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });
        }

        const shop = await Shop.findOne({ mobile });
        if (!shop) return res.status(400).json({ message: 'Please verify mobile first.' });
        if (!shop.mobileVerified) return res.status(400).json({ message: 'Mobile not verified.' });
        if (!shop.emailVerified) return res.status(400).json({ message: 'Email not verified.' });

        const files = req.files || {};

        // ── KEY FIX: normalise ALL file paths before saving ──────────────────
        // multer.path on Windows:  "C:\...\uploads\1234-photo.jpg"
        // normPath converts to:    "uploads/1234-photo.jpg"
        // Express serves at:       GET /uploads/1234-photo.jpg  ✅
        const ownerPhotoPath = resolveMediaPath(files.ownerPhoto?.[0]);
        const idProofPath = resolveMediaPath(files.idProof?.[0]);
        const shopLogoPath = resolveMediaPath(files.shopLogo?.[0]);
        const shopPhotoPath = resolveMediaPath(files.shopPhoto?.[0]);
        const gstnCertPath = resolveMediaPath(files.gstnCertificate?.[0]);

        shop.ownerName = ownerName;
        shop.email = email;
        shop.password = password;
        shop.shopName = shopName;
        shop.shopLogo = shopLogoPath;
        shop.shopPhoto = shopPhotoPath;
        shop.gstNumber = gstNumber || null;
        shop.gstnCertificate = gstnCertPath;
        shop.category = category;
        shop.address = address;
        shop.city = city;
        shop.pincode = pincode || '';
        shop.locality = locality || '';
        shop.ownerPhoto = ownerPhotoPath;
        shop.idProof = { idType: idType || 'Aadhar Card', filePath: idProofPath };

        // Store location if provided
        if (latitude && longitude) {
            shop.shopLocation = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
            };
        }

        shop.verificationStatus = 'pending';

        await shop.save();
        return res.status(201).json({
            message: 'Registration submitted. We will contact you within 24 hours.',
        });
    } catch (err) {
        console.error('registerShop:', err?.stack || err);
        return res.status(500).json({ message: err?.message || 'Registration failed.' });
    }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.loginShop = async (req, res) => {
    try {
        const { mobile, password } = req.body;
        if (!mobile || !password)
            return res.status(400).json({ message: 'Mobile and password required.' });

        const shop = await Shop.findOne({ mobile }).select('+password');
        if (!shop)
            return res.status(401).json({ message: 'Invalid credentials.' });

        if (shop.verificationStatus !== 'approved')
            return res.status(403).json({
                message: shop.verificationStatus === 'pending'
                    ? 'Your shop is under review. Admin will contact you within 24 hours.'
                    : shop.verificationStatus === 'blocked'
                        ? 'Your shop account has been blocked. Contact support.'
                        : 'Shop not approved.',
            });

        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, shop.password);
        if (!isMatch)
            return res.status(401).json({ message: 'Invalid credentials.' });

        const token = signToken(shop._id);
        const shopData = shop.toObject();
        delete shopData.password;

        return res.json({ token, shop: shopData });
    } catch (err) {
        console.error('loginShop:', err);
        return res.status(500).json({ message: 'Login failed.' });
    }
};
