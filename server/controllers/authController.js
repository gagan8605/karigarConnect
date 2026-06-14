// server/controllers/authController.js
// Face verification is integrated into registerWorker and registerClient.
// The Python face service (port 8001) is called AFTER the user record is saved.
// If the face service is unreachable, registration proceeds gracefully with a
// faceVerificationStatus of 'skipped' and a server warning log.

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel');
const faceClient = require('../utils/faceServiceClient');
const { sendOtpSms } = require('../utils/smsHelper');
const { sendOtpEmail } = require('../utils/emailHelper');
const { getOtpCooldownState, markOtpCooldown, formatOtpCooldownMessage } = require('../utils/otpCooldown');
const { logAuditEvent } = require('../utils/auditLogger');
const { getConfiguredAdminAccounts } = require('../utils/adminAccounts');
const { validateStrongPassword, PASSWORD_POLICY_TEXT } = require('../utils/passwordPolicy');
const { upsertWorkerById } = require('../services/semanticMatchingService');
const { MAX_WORKER_SKILLS, normalizeWorkerSkillSelections } = require('../constants/workerSkills');

// ── OTP store (in-memory; production: use Redis) ──────────────────────────────
const otpStore = new Map(); // key: mobile/email → { otp, expiry }
const otpAttemptStore = new Map(); // key: mobile/email → { attempts, lockedUntil }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_VERIFY_ATTEMPTS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateUserId = () =>
    'KC-' + Math.random().toString(36).substring(2, 7).toUpperCase() +
    Math.floor(100 + Math.random() * 900);

const normalizeIdNumber = (value = '') => String(value).replace(/\s+/g, '').toUpperCase().trim();

const validateWorkerIdNumber = (idType = '', rawNumber = '') => {
    const normalized = normalizeIdNumber(rawNumber);

    if (!normalized) {
        return { valid: false, normalized, message: 'ID number is required.' };
    }

    if (idType === 'Aadhar Card') {
        if (!/^\d{12}$/.test(normalized)) {
            return { valid: false, normalized, message: 'Aadhaar number must be exactly 12 digits.' };
        }
        return { valid: true, normalized };
    }

    if (idType === 'PAN Card') {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
            return { valid: false, normalized, message: 'PAN number format is invalid (example: ABCDE1234F).' };
        }
        return { valid: true, normalized };
    }

    return { valid: true, normalized };
};

const hashWorkerIdNumber = (normalizedIdNumber) => {
    const secret = process.env.ID_PROOF_HASH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('Missing ID proof hash secret. Set ID_PROOF_HASH_SECRET or JWT_SECRET.');
    }
    return crypto.createHmac('sha256', secret).update(String(normalizedIdNumber)).digest('hex');
};

const normalizeTravelMethod = (value = '') => {
    const method = String(value || '').trim().toLowerCase();
    const allowed = new Set(['cycle', 'bike', 'bus', 'other']);
    return allowed.has(method) ? method : 'other';
};

const parseBoolean = (value) => value === true || String(value).toLowerCase() === 'true';

const parseDateOnly = (dateValue) => {
    if (!dateValue || typeof dateValue !== 'string') return null;
    const [year, month, day] = String(dateValue).split('-').map(Number);
    if (!year || !month || !day) return null;
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
};

const calculateAgeFromDob = (dobValue) => {
    const dobDate = parseDateOnly(String(dobValue || ''));
    if (!dobDate || Number.isNaN(dobDate.getTime())) return null;

    const now = new Date();
    let years = now.getFullYear() - dobDate.getFullYear();
    const monthDelta = now.getMonth() - dobDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dobDate.getDate())) years -= 1;
    return years;
};

const signToken = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const safeGet = (files, field) => files?.[field]?.[0] ?? null;

// ── OTP ───────────────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
    try {
        const { mobile, email, type } = req.body;
        const identifier = mobile || email;
        if (!identifier) return res.status(400).json({ message: 'Mobile or email required.' });

        // Check if user is already registered using both mobile and email if provided
        const query = { $or: [] };
        if (mobile) query.$or.push({ mobile });
        if (email) query.$or.push({ email });
        const existingUser = await User.findOne(query).select('role mobile email').lean();
        if (existingUser) {
            const matchedField = existingUser.mobile === mobile ? 'mobile number' : 'email';
            return res.status(409).json({
                message: `This ${matchedField} is already registered as a ${existingUser.role}. Please login instead.`,
                alreadyRegistered: true
            });
        }

        // Each identifier (mobile/email) has its own 30-second cooldown
        const cooldownKey = `auth:send-otp:${String(identifier).trim().toLowerCase()}`;
        const cooldown = getOtpCooldownState(cooldownKey);
        if (!cooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(cooldown.remainingMs),
                retryAfterSeconds: Math.ceil(cooldown.remainingMs / 1000),
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + OTP_TTL_MS;
        otpStore.set(identifier, { otp, expiry });
        otpAttemptStore.delete(identifier);

        let smsDelivered = false;
        let emailDelivered = false;
        let smsError = null;
        let emailError = null;

        if (mobile) {
            try {
                const smsResult = await sendOtpSms(mobile, otp);
                smsDelivered = smsResult?.success === true;
                if (!smsDelivered) smsError = smsResult?.reason || 'Unknown SMS error';
            } catch (err) {
                smsError = err.message;
                console.error(`[OTP] SMS send error for ${mobile}:`, smsError);
            }
        }

        if (email) {
            try {
                await sendOtpEmail(email, otp);
                emailDelivered = true;
            } catch (err) {
                emailError = err.message;
                console.error(`[OTP] Email send error for ${email}:`, emailError);
            }
        }

        // At least one channel must succeed
        if (!smsDelivered && !emailDelivered) {
            otpStore.delete(identifier);
            console.error(`[OTP] Both channels failed. SMS: ${smsError}, Email: ${emailError}`);
            return res.status(500).json({
                message: 'Failed to send OTP via SMS and Email. Please try again.',
                debug: { smsError, emailError }
            });
        }

        // Mark cooldown for this specific identifier
        markOtpCooldown(cooldownKey);

        return res.json({
            message: 'OTP sent successfully.',
            channels: { sms: smsDelivered, email: emailDelivered },
            expiresAt: new Date(expiry).toISOString(),
        });
    } catch (err) {
        console.error('[OTP] Unexpected error in sendOtp:', err);
        return res.status(500).json({ message: 'Failed to send OTP.' });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp) return res.status(400).json({ message: 'identifier and otp required.' });

        const attemptState = otpAttemptStore.get(identifier) || { attempts: 0, lockedUntil: 0 };
        if (attemptState.lockedUntil && Date.now() < attemptState.lockedUntil) {
            return res.status(429).json({ message: 'Too many OTP attempts. Request a new OTP and try again.' });
        }

        const record = otpStore.get(identifier);
        if (!record) return res.status(400).json({ message: 'OTP not sent or expired.' });
        if (Date.now() > record.expiry) return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
        if (record.otp !== otp.trim()) {
            const attempts = attemptState.attempts + 1;
            const lockedUntil = attempts >= OTP_MAX_VERIFY_ATTEMPTS ? Date.now() + OTP_TTL_MS : 0;
            otpAttemptStore.set(identifier, { attempts, lockedUntil });

            if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
                otpStore.delete(identifier);
                return res.status(429).json({ message: 'Too many invalid attempts. Request a new OTP.' });
            }

            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        otpStore.delete(identifier);
        otpAttemptStore.delete(identifier);
        
        // Generate a verified token that the frontend must pass during registration
        const otpVerifiedToken = jwt.sign({ verifiedIdentifier: identifier, type: 'otp_verification' }, process.env.JWT_SECRET, { expiresIn: '15m' });
        
        return res.json({ message: 'OTP verified successfully.', otpVerifiedToken });
    } catch { return res.status(500).json({ message: 'Failed to verify OTP.' }); }
};

// Public endpoint to let workers check application status using mobile or userId.
exports.getWorkerApplicationStatus = async (req, res) => {
    try {
        const identifierRaw = (req.body?.identifier || req.query?.identifier || '').trim();
        if (!identifierRaw) {
            return res.status(400).json({ message: 'Phone number or User ID is required.' });
        }

        const identifier = identifierRaw.toUpperCase();
        const worker = await User.findOne({
            role: 'worker',
            $or: [
                { mobile: identifierRaw },
                { userId: identifier },
                { karigarId: identifier },
            ],
        }).select('name mobile userId karigarId verificationStatus rejectionReason');

        if (!worker) {
            return res.status(404).json({
                registered: false,
                message: 'No worker registration found. Please register first.',
            });
        }

        const status = worker.verificationStatus || 'pending';
        let statusMessage = 'Admin is verifying your application. Please wait up to 48 hours. If you do not get a response, contact us.';

        if (status === 'rejected') {
            statusMessage = 'Your application was rejected by admin.';
        }
        if (status === 'approved') {
            statusMessage = 'Your application is approved. You can apply to jobs now.';
        }

        return res.json({
            registered: true,
            status,
            statusMessage,
            rejectionReason: status === 'rejected' ? (worker.rejectionReason || 'No reason provided by admin.') : null,
            worker: {
                name: worker.name,
                mobile: worker.mobile,
                userId: worker.userId || worker.karigarId,
                karigarId: worker.karigarId,
            },
        });
    } catch (err) {
        console.error('getWorkerApplicationStatus:', err);
        return res.status(500).json({ message: 'Unable to fetch application status.' });
    }
};

// Preview similarity for registration UI before final submit.
// Accepts multipart fields: idProof, livePhoto (memory uploads).
exports.previewFaceSimilarity = async (req, res) => {
    try {
        const idProofFile = safeGet(req.files, 'idProof');
        const livePhotoFile = safeGet(req.files, 'livePhoto');

        if (!idProofFile || !livePhotoFile) {
            return res.status(400).json({
                message: 'Both idProof and livePhoto are required.',
            });
        }

        const available = await faceClient.isAvailable();
        if (!available) {
            return res.status(503).json({
                message: 'Face verification service is not available. Please try again shortly.',
            });
        }

        const [idBuffer, liveBuffer] = [idProofFile.buffer, livePhotoFile.buffer];

        const [idResult, liveResult] = await Promise.all([
            faceClient.extractEmbedding(idBuffer, idProofFile.originalname || 'id_card.jpg'),
            faceClient.extractEmbedding(liveBuffer, livePhotoFile.originalname || 'live_face.jpg'),
        ]);

        if (!idResult?.face_detected) {
            return res.json({
                passed: false,
                similarity: 0,
                threshold: faceClient.WORKER_THRESHOLD,
                idFaceDetected: false,
                liveFaceDetected: !!liveResult?.face_detected,
                message: 'Face not detected in ID proof. Upload a clearer ID image.',
            });
        }

        if (!liveResult?.face_detected) {
            return res.json({
                passed: false,
                similarity: 0,
                threshold: faceClient.WORKER_THRESHOLD,
                idFaceDetected: true,
                liveFaceDetected: false,
                message: 'Live face not detected. Keep your face centered and well-lit.',
            });
        }

        const comparison = await faceClient.compareEmbeddings(idResult.embedding, liveResult.embedding);
        const similarity = Number(comparison?.similarity || 0);
        const threshold = Number(faceClient.WORKER_THRESHOLD);

        return res.json({
            passed: similarity >= threshold,
            similarity,
            threshold,
            idFaceDetected: true,
            liveFaceDetected: true,
            message: similarity >= threshold
                ? 'Face similarity check passed.'
                : 'Face similarity is below threshold. Please retry with a clearer face and better ID photo.',
        });
    } catch (err) {
        console.error('previewFaceSimilarity:', err.message);
        return res.status(500).json({ message: 'Unable to check face similarity right now.' });
    }
};

// ── REGISTER WORKER ───────────────────────────────────────────────────────────
exports.registerWorker = async (req, res) => {
    try {
        const {
            name, dob, mobile, email, password, confirmPassword,
            city, pincode, locality, fullAddress, village, latitude, longitude, experience,
            idNumber, gender, eShramNumber, idDocumentType,
            emergencyContactName, emergencyContactMobile, phoneType, travelMethod, ageConsent, skills, references, primarySkill,
            expectedMinPay, expectedMaxPay, preferredJobCategories,
            otpVerifiedToken,
        } = req.body;

        // ── OTP Verification Validation ───────────────────────────────────────
        if (!otpVerifiedToken) {
            return res.status(403).json({ message: 'OTP verification is required. Please verify your mobile number first.' });
        }
        try {
            const decodedOtp = jwt.verify(otpVerifiedToken, process.env.JWT_SECRET);
            if (decodedOtp.type !== 'otp_verification' || decodedOtp.verifiedIdentifier !== mobile) {
                return res.status(403).json({ message: 'OTP verification mismatch. Please verify the mobile number you are trying to register.' });
            }
        } catch (err) {
            return res.status(403).json({ message: 'OTP verification token is invalid or expired. Please verify your mobile number again.' });
        }

        // ── Basic validation ──────────────────────────────────────────────────
        if (!name?.trim()) return res.status(400).json({ message: 'Full name is required.' });
        if (!mobile) return res.status(400).json({ message: 'Mobile number is required.' });
        if (!password) return res.status(400).json({ message: 'Password is required.' });
        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Passwords do not match.' });
        if (!validateStrongPassword(password).isValid)
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });

        if (!dob) {
            return res.status(400).json({ message: 'Date of birth is required.' });
        }

        const computedAge = calculateAgeFromDob(dob);
        if (computedAge === null) {
            return res.status(400).json({ message: 'Date of birth is invalid.' });
        }
        if (computedAge < 18)
            return res.status(400).json({ message: 'You must be at least 18 years old.' });

        if (!parseBoolean(ageConsent)) {
            return res.status(400).json({ message: 'Age consent is required for registration.' });
        }

        // ── Duplicate check ───────────────────────────────────────────────────
        if (await User.findOne({ mobile }))
            return res.status(409).json({ message: 'Mobile number is already registered.' });
        if (email && await User.findOne({ email }))
            return res.status(409).json({ message: 'Email is already registered.' });

        // ── Uploaded file URLs (Cloudinary via multer) ────────────────────────
        const photoFile = safeGet(req.files, 'photo');
        const idProofFile = safeGet(req.files, 'idProof');
        const eShramFile = safeGet(req.files, 'eShramCard');
        const livePhotoFile = safeGet(req.files, 'livePhoto');  // face capture

        if (!photoFile) return res.status(400).json({ message: 'Profile photo is required.' });
        if (!idProofFile) return res.status(400).json({ message: 'ID proof is required.' });

        const resolvedIdType = idDocumentType || 'Aadhar Card';
        const idValidation = validateWorkerIdNumber(resolvedIdType, idNumber);
        if (!idValidation.valid) {
            return res.status(400).json({ message: idValidation.message });
        }

        const idHash = hashWorkerIdNumber(idValidation.normalized);
        const existingWorkerWithId = await User.findOne({ role: 'worker', 'idProof.numberHash': idHash }).select('_id');
        if (existingWorkerWithId) {
            return res.status(409).json({ message: `${resolvedIdType} number is already registered.` });
        }

        const skillCerts = req.files?.skillCertificates?.map(f => f.path) || [];
        const portfolio = req.files?.portfolioPhotos?.map(f => f.path) || [];

        if (skillCerts.length > 3) {
            return res.status(400).json({ message: 'Maximum 3 skill certificates are allowed during registration.' });
        }
        if (portfolio.length > 4) {
            return res.status(400).json({ message: 'Maximum 4 portfolio photos are allowed during registration.' });
        }

        let parsedSkills = [];
        try { parsedSkills = JSON.parse(skills || '[]'); } catch { }
        const normalizedSkills = normalizeWorkerSkillSelections(parsedSkills, primarySkill);

        if (normalizedSkills.length === 0) {
            return res.status(400).json({ message: 'At least one valid skill is required.' });
        }
        if ((Array.isArray(parsedSkills) ? parsedSkills.length : 0) > MAX_WORKER_SKILLS || normalizedSkills.length > MAX_WORKER_SKILLS) {
            return res.status(400).json({ message: `Maximum ${MAX_WORKER_SKILLS} skills are allowed.` });
        }

        let parsedRefs = [];
        try { parsedRefs = JSON.parse(references || '[]'); } catch { }

        let parsedPreferredCategories = [];
        try { parsedPreferredCategories = JSON.parse(preferredJobCategories || '[]'); } catch { }

        const normalizedTravelMethod = normalizeTravelMethod(travelMethod);

        // ── Create user ───────────────────────────────────────────────────────
        const user = await User.create({
            userId: generateUserId(),
            role: 'worker', name: name.trim(), dob, age: computedAge, mobile, phoneType,
            email: email || null, password,
            address: {
                city,
                pincode,
                locality,
                fullAddress,
                village,
                latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : undefined,
                longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : undefined,
            },
            idProof: {
                idType: resolvedIdType,
                filePath: idProofFile.path,
                numberHash: idHash,
                numberLast4: idValidation.normalized.slice(-4),
            },
            photo: photoFile.path,
            gender, eShramNumber,
            eShramCardPath: eShramFile?.path || null,
            experience: Number(experience) || 0,
            expectedMinPay: Number(expectedMinPay) || 0,
            expectedMaxPay: Number(expectedMaxPay) || 0,
            travelMethod: normalizedTravelMethod,
            preferredJobCategories: Array.isArray(parsedPreferredCategories) ? parsedPreferredCategories : [],
            skills: normalizedSkills, references: parsedRefs,
            skillCertificates: skillCerts, portfolioPhotos: portfolio,
            emergencyContact: { name: emergencyContactName, mobile: emergencyContactMobile },
            verificationStatus: 'pending',
            faceVerificationStatus: 'pending_review',
        });

        try {
            await upsertWorkerById(user._id);
        } catch (err) {
            console.error('semantic upsertWorkerById(registerWorker):', err.message);
        }

        // ── Face verification (non-blocking) ─────────────────────────────────
        if (livePhotoFile) {
            runWorkerFaceVerification(user, idProofFile.path, livePhotoFile.path)
                .catch(err => console.error('[FaceVerification] Worker async error:', err.message));
        } else {
            await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
            console.warn(`[FaceVerification] No live photo for worker ${user._id} — skipped`);
        }

        return res.status(201).json({
            message: 'Registration submitted. Your profile is under review.',
            requiresApproval: true,
            faceVerification: livePhotoFile ? 'processing' : 'skipped',
        });

    } catch (err) {
        console.error('registerWorker:', err);
        return res.status(500).json({ message: err.message || 'Registration failed.' });
    }
};

/** Background task: extract ID + live embeddings, compare, store result */
const runWorkerFaceVerification = async (user, idProofUrl, livePhotoUrl) => {
    const available = await faceClient.isAvailable();
    if (!available) {
        await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
        console.warn(`[FaceVerification] Face service unavailable for worker ${user._id}`);
        return;
    }

    try {
        // Download images from Cloudinary
        const [idBuffer, liveBuffer] = await Promise.all([
            faceClient.downloadImage(idProofUrl),
            faceClient.downloadImage(livePhotoUrl),
        ]);

        // Extract embeddings
        const [idResult, liveResult] = await Promise.all([
            faceClient.extractEmbedding(idBuffer, 'id_card.jpg'),
            faceClient.extractEmbedding(liveBuffer, 'live_face.jpg'),
        ]);

        if (!idResult.face_detected) {
            await User.findByIdAndUpdate(user._id, {
                faceVerificationStatus: 'failed',
                liveFacePhoto: livePhotoUrl,
            });
            console.warn(`[FaceVerification] No face in ID card for worker ${user._id}`);
            return;
        }
        if (!liveResult.face_detected) {
            await User.findByIdAndUpdate(user._id, {
                faceVerificationStatus: 'failed',
                liveFacePhoto: livePhotoUrl,
            });
            console.warn(`[FaceVerification] No face in live photo for worker ${user._id}`);
            return;
        }

        // Compare
        const comparison = await faceClient.compareEmbeddings(
            idResult.embedding, liveResult.embedding
        );

        const passed = comparison.similarity >= faceClient.WORKER_THRESHOLD;

        await User.findByIdAndUpdate(user._id, {
            faceEmbedding: liveResult.embedding,
            idFaceEmbedding: idResult.embedding,
            liveFacePhoto: livePhotoUrl,
            faceVerificationScore: comparison.similarity,
            faceVerified: passed,
            faceVerifiedAt: new Date(),
            faceVerificationStatus: passed ? 'passed' : 'failed',
        });

        console.log(
            `[FaceVerification] Worker ${user._id} — similarity=${comparison.similarity.toFixed(3)} ${passed ? '✅ PASSED' : '❌ FAILED'}`
        );
    } catch (err) {
        await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
        console.error(`[FaceVerification] Worker ${user._id} error:`, err.message);
    }
};

// ── REGISTER CLIENT ───────────────────────────────────────────────────────────
exports.registerClient = async (req, res) => {
    try {
        const {
            name, mobile, email, password, confirmPassword,
            age, dob, gender,
            city, pincode, locality, homeLocation, houseNumber, fullAddress, village, latitude, longitude, idType, workplaceInfo, socialProfile,
            // NEW HIGH PRIORITY Security Fields
            ageVerified, emergencyContactName, emergencyContactMobile,
            profession, signupReason, previousHiringExperience, preferredPaymentMethod,
            // NEW MEDIUM PRIORITY Fields
            businessRegistrationNumber, gstTaxId, professionalCertification, insuranceDetails,
            securityQuestion, securityAnswer,
            // T&C acceptance
            termsPaymentAccepted, termsDisputePolicyAccepted, termsDataPrivacyAccepted, termsWorkerProtectionAccepted,
            termsAccepted, privacyAccepted,
            otpVerifiedToken,
        } = req.body;

        // ── OTP Verification Validation ───────────────────────────────────────
        if (!otpVerifiedToken) {
            return res.status(403).json({ message: 'OTP verification is required. Please verify your mobile number first.' });
        }
        try {
            const decodedOtp = jwt.verify(otpVerifiedToken, process.env.JWT_SECRET);
            if (decodedOtp.type !== 'otp_verification' || decodedOtp.verifiedIdentifier !== mobile) {
                return res.status(403).json({ message: 'OTP verification mismatch. Please verify the mobile number you are trying to register.' });
            }
        } catch (err) {
            return res.status(403).json({ message: 'OTP verification token is invalid or expired. Please verify your mobile number again.' });
        }

        // ── Validation ────────────────────────────────────────────────────────
        if (!name?.trim()) return res.status(400).json({ message: 'Name is required.' });
        if (!mobile) return res.status(400).json({ message: 'Mobile is required.' });
        if (!email) return res.status(400).json({ message: 'Email is required.' });
        if (!password) return res.status(400).json({ message: 'Password is required.' });
        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Passwords do not match.' });
        if (!validateStrongPassword(password).isValid)
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });

        const ageNum = Number(age);
        if (!Number.isFinite(ageNum) || ageNum <= 0) {
            return res.status(400).json({ message: 'Age must be a positive number.' });
        }
        if (ageNum < 18) {
            return res.status(400).json({ message: 'Age must be 18 or above.' });
        }

        if (!dob) {
            return res.status(400).json({ message: 'Birth date is required.' });
        }
        const dobDate = parseDateOnly(dob);
        if (!dobDate || Number.isNaN(dobDate.getTime())) {
            return res.status(400).json({ message: 'Birth date is invalid.' });
        }
        if (dobDate > new Date()) {
            return res.status(400).json({ message: 'Birth date cannot be in the future.' });
        }

        const ageFromDob = calculateAgeFromDob(dob);
        if (ageFromDob === null) {
            return res.status(400).json({ message: 'Birth date is invalid.' });
        }
        if (ageFromDob < 18) {
            return res.status(400).json({ message: 'Birth date indicates age below 18.' });
        }

        if (!['Male', 'Female', 'Other'].includes(gender)) {
            return res.status(400).json({ message: 'Gender is required.' });
        }

        const toBool = (v) => v === true || v === 'true';
        const acceptedTerms = toBool(termsAccepted) || toBool(termsPaymentAccepted) || toBool(termsDisputePolicyAccepted) || toBool(termsWorkerProtectionAccepted);
        const acceptedPrivacy = toBool(privacyAccepted) || toBool(termsDataPrivacyAccepted);

        // NEW: Security validations
        if (!toBool(ageVerified) && ageNum < 18)
            return res.status(400).json({ message: 'Must be 18 or older to register.' });
        if (!emergencyContactMobile || !emergencyContactName)
            return res.status(400).json({ message: 'Emergency contact details are required.' });
        if (!profession?.trim())
            return res.status(400).json({ message: 'Profession is required.' });
        if (!signupReason)
            return res.status(400).json({ message: 'Signup reason is required.' });
        if (!(previousHiringExperience === 'true' || previousHiringExperience === 'false' || typeof previousHiringExperience === 'boolean'))
            return res.status(400).json({ message: 'Please specify previous hiring experience.' });
        if (!preferredPaymentMethod)
            return res.status(400).json({ message: 'Preferred payment method is required.' });
        if (!securityQuestion?.trim() || !securityAnswer?.trim())
            return res.status(400).json({ message: 'Security question and answer are required.' });
        if (!acceptedTerms || !acceptedPrivacy)
            return res.status(400).json({ message: 'You must accept Terms and Privacy Policy.' });

        if (await User.findOne({ mobile }))
            return res.status(409).json({ message: 'Mobile number is already registered.' });
        if (await User.findOne({ email }))
            return res.status(409).json({ message: 'Email is already registered.' });

        // ── File URLs & Device Fingerprinting ─────────────────────────────────
        const photoFile = safeGet(req.files, 'photo');
        const idProofFile = safeGet(req.files, 'idProof');
        const proofOfResidenceFile = safeGet(req.files, 'proofOfResidence');
        const secondaryIdFile = safeGet(req.files, 'secondaryIdProof');
        const certificationFile = safeGet(req.files, 'professionalCertification');
        const livePhotoFile = safeGet(req.files, 'livePhoto');

        if (!livePhotoFile)
            return res.status(400).json({ message: 'Live face photo is required for identity verification.' });
        if (!idProofFile)
            return res.status(400).json({ message: 'ID proof is required for identity verification.' });
        if (!proofOfResidenceFile)
            return res.status(400).json({ message: 'Proof of residence is required.' });

        // NEW: Capture IP & device fingerprint
        const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'] || 'unknown';
        const crypto = require('crypto');
        const deviceFingerprint = crypto
            .createHash('sha256')
            .update(`${clientIp}${userAgent}`)
            .digest('hex');

        // ── Face match + duplicate check for clients ─────────────────────────
        const faceServiceUp = await faceClient.isAvailable();
        if (!faceServiceUp) {
            return res.status(503).json({
                message: 'Identity verification service is temporarily unavailable. Please try again in a moment.',
            });
        }

        let faceEmbedding = null;
        let idFaceEmbedding = null;
        let faceVerificationScore = null;
        let faceVerified = false;
        let faceVerificationStatus = 'skipped';
        let liveFacePhoto = livePhotoFile?.path || null;

        if (faceServiceUp) {
            const [idBuffer, liveBuffer] = await Promise.all([
                faceClient.downloadImage(idProofFile.path),
                faceClient.downloadImage(livePhotoFile.path),
            ]);

            const [idResult, liveResult] = await Promise.all([
                faceClient.extractEmbedding(idBuffer, 'client_id.jpg'),
                faceClient.extractEmbedding(liveBuffer, 'live_face.jpg'),
            ]);

            if (!idResult.face_detected) {
                return res.status(400).json({
                    message: 'No face detected in ID proof. Please upload a clearer ID image.',
                    faceError: true,
                });
            }

            if (!liveResult.face_detected) {
                return res.status(400).json({
                    message: 'No face detected in the live photo. Please redo the face verification with better lighting.',
                    faceError: true,
                });
            }

            const comparison = await faceClient.compareEmbeddings(idResult.embedding, liveResult.embedding);
            const similarity = Number(comparison?.similarity || 0);
            const threshold = Number(faceClient.WORKER_THRESHOLD);

            if (similarity < threshold) {
                return res.status(400).json({
                    message: 'Face similarity is below threshold. Please retry face verification and upload a clearer ID photo.',
                    faceError: true,
                    similarity,
                    threshold,
                });
            }

            // Fetch all existing client face embeddings for duplicate check
            const existingClients = await User.find({ role: 'client', faceEmbedding: { $exists: true, $ne: null } })
                .select('faceEmbedding')
                .lean();
            const storedEmbeddings = existingClients
                .map(c => c.faceEmbedding)
                .filter(e => Array.isArray(e) && e.length === 512);

            if (storedEmbeddings.length > 0) {
                const dupResult = await faceClient.checkDuplicate(liveResult.embedding, storedEmbeddings);
                if (dupResult.is_duplicate) {
                    console.warn(`[FaceVerification] Duplicate face detected (similarity=${dupResult.max_similarity.toFixed(3)})`);
                    return res.status(409).json({
                        message: 'A KarigarConnect account already exists for this face. Duplicate registrations are not allowed.',
                        duplicateFace: true,
                        similarity: dupResult.max_similarity,
                    });
                }
            }

            faceEmbedding = liveResult.embedding;
            idFaceEmbedding = idResult.embedding;
            faceVerificationScore = similarity;
            faceVerified = true;
            faceVerificationStatus = 'passed';
            console.log(`[FaceVerification] Client verified — similarity=${similarity.toFixed(3)} ✅ no duplicate found`);
        }

        // NEW: Generate address verification OTP
        const addressOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const { sendAddressVerificationOtp } = require('../utils/smsHelper');
        const addressDisplay = `${fullAddress}, ${city}`;
        const addressCooldownKey = `auth:address-otp:${mobile}`;
        const addressCooldown = getOtpCooldownState(addressCooldownKey);
        if (!addressCooldown.allowed) {
            return res.status(429).json({
                message: formatOtpCooldownMessage(addressCooldown.remainingMs),
                retryAfterSeconds: Math.ceil(addressCooldown.remainingMs / 1000),
            });
        }

        try {
            const result = await sendAddressVerificationOtp(mobile, addressOtp, addressDisplay);
            if (result?.success === false) {
                throw new Error(result.reason || 'sms_send_failed');
            }
            markOtpCooldown(addressCooldownKey);
            console.log(`[AddressOTP] Sent to ${mobile} for address: ${addressDisplay}`);
        } catch (err) {
            console.warn(`[AddressOTP] Failed to send: ${err.message}`);
            // Continue registration even if OTP send fails
        }

        // ── Create client ─────────────────────────────────────────────────────
        const user = await User.create({
            userId: generateUserId(),
            role: 'client', name: name.trim(), mobile, email,
            age: ageFromDob,
            dob: dobDate,
            gender,
            password,
            photo: photoFile?.path || null,
            address: {
                city,
                pincode,
                locality,
                homeLocation,
                houseNumber,
                fullAddress,
                village,
                latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : undefined,
                longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : undefined,
            },
            idProof: { idType: idType || 'Aadhar', filePath: idProofFile?.path || null },

            // NEW high priority security fields
            ageVerified: ageFromDob >= 18,
            emergencyContact: {
                name: emergencyContactName?.trim() || '',
                mobile: emergencyContactMobile?.trim() || '',
            },
            proofOfResidence: proofOfResidenceFile?.path || null,
            secondaryIdProof: secondaryIdFile?.path || null,
            addressVerificationOtp: addressOtp,
            addressVerificationOtpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 min

            // NEW medium priority fields
            profession: profession?.trim() || '',
            signupReason: signupReason || '',
            previousHiringExperience: previousHiringExperience === 'true' ? true : previousHiringExperience === 'false' ? false : null,
            preferredPaymentMethod: preferredPaymentMethod || '',
            businessRegistrationNumber: businessRegistrationNumber?.trim() || '',
            gstTaxId: gstTaxId?.trim() || '',
            professionalCertification: certificationFile?.path || '',
            insuranceDetails: insuranceDetails?.trim() || '',
            securityQuestion: securityQuestion?.trim() || '',
            securityAnswer: securityAnswer?.trim() || '',

            // Device & IP tracking
            deviceFingerprint,
            signupIpAddress: clientIp,
            signupUserAgent: userAgent,

            // T&C acceptance
            termsPaymentAccepted: acceptedTerms,
            termsDisputePolicyAccepted: acceptedTerms,
            termsDataPrivacyAccepted: acceptedPrivacy,
            termsWorkerProtectionAccepted: acceptedTerms,

            // Legacy fields
            workplaceInfo, socialProfile,
            verificationStatus: 'approved',  // clients auto-approved
            faceEmbedding,
            idFaceEmbedding,
            faceVerificationScore,
            liveFacePhoto,
            faceVerified,
            faceVerificationStatus,
            faceVerifiedAt: faceVerified ? new Date() : null,
        });

        const token = signToken(user._id, 'client');
        return res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: {
                id: user._id, name: user.name, role: 'client',
                photo: user.photo,
                userId: user.userId || user.karigarId,
                karigarId: user.karigarId,
            },
            faceVerification: faceVerificationStatus,
            addressVerificationNeeded: true, // Client needs to verify address with OTP
        });

    } catch (err) {
        console.error('registerClient:', err);
        return res.status(500).json({ message: err.message || 'Registration failed.' });
    }
};

// ── NEW: Verify Address OTP (Called by client after registration) ───────────────
exports.verifyAddressOtp = async (req, res) => {
    try {
        const { clientId, otp } = req.body;

        if (!clientId || !otp) {
            return res.status(400).json({ message: 'Client ID and OTP are required.' });
        }

        const client = await User.findById(clientId).select('+addressVerificationOtp');
        if (!client || client.role !== 'client') {
            return res.status(404).json({ message: 'Client not found.' });
        }

        if (!client.addressVerificationOtp) {
            return res.status(400).json({ message: 'No pending address verification.' });
        }

        if (Date.now() > client.addressVerificationOtpExpiry) {
            return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
        }

        if (client.addressVerificationOtp !== otp.trim()) {
            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        // OTP verified, mark address as verified
        client.addressVerified = true;
        client.addressVerificationOtp = undefined; // Clear OTP
        client.addressVerificationOtpExpiry = undefined;
        await client.save();

        console.log(`[AddressVerification] Client ${client.userId || client.karigarId} address verified ✅`);

        return res.json({
            message: 'Address verified successfully!',
            addressVerified: true,
        });
    } catch (err) {
        console.error('verifyAddressOtp:', err);
        return res.status(500).json({ message: 'Verification failed.' });
    }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.loginWithPassword = async (req, res) => {
    try {
        const { role, mobile, password } = req.body;
        if (!role || !mobile || !password) {
            return res.status(400).json({ message: 'Role, mobile and password are required.' });
        }

        if (!['worker', 'client', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role selected.' });
        }

        if (role === 'admin') {
            const submittedMobile = String(mobile || '').trim();
            const configuredAccounts = getConfiguredAdminAccounts();
            const allowedMobiles = configuredAccounts.map(acc => acc.mobile);

            if (!allowedMobiles.includes(submittedMobile)) {
                await logAuditEvent({ action: 'failed_login', req, metadata: { role: 'admin', mobile: submittedMobile, reason: 'not_allowed_admin_mobile' } });
                return res.status(401).json({ message: 'Invalid mobile number or password.' });
            }

            // Get admin account from .env file (to get latest name if env was updated)
            const adminAccountFromEnv = configuredAccounts.find(acc => acc.mobile === submittedMobile);

            const adminUser = await User.findOne({ role: 'admin', mobile: submittedMobile }).select('+password name userId karigarId photo mobile role');
            if (!adminUser) {
                await logAuditEvent({ action: 'failed_login', req, metadata: { role: 'admin', mobile: submittedMobile, reason: 'admin_not_found' } });
                return res.status(401).json({ message: 'Invalid mobile number or password.' });
            }

            const isMatch = await bcrypt.compare(password, adminUser.password);
            if (!isMatch) {
                await logAuditEvent({ userId: adminUser._id, role: 'admin', action: 'failed_login', req, metadata: { reason: 'password_mismatch' } });
                return res.status(401).json({ message: 'Invalid mobile number or password.' });
            }

            await logAuditEvent({ userId: adminUser._id, role: 'admin', action: 'login', req });

            const token = signToken(adminUser._id, 'admin');
            return res.json({
                message: 'Login successful.',
                token,
                user: {
                    id: adminUser._id,
                    name: adminAccountFromEnv?.name || adminUser.name,
                    role: 'admin',
                    photo: adminUser.photo || null,
                    userId: adminUser.userId || adminUser.karigarId,
                    karigarId: adminUser.karigarId,
                },
            });
        }

        const user = await User.findOne({ mobile, role }).select('+password');
        if (!user) {
            const existingUser = await User.findOne({ mobile }).select('role');
            await logAuditEvent({ action: 'failed_login', req, metadata: { mobile, role, reason: existingUser ? 'role_mismatch' : 'user_not_found' } });
            if (existingUser) {
                return res.status(401).json({ message: `This account is registered as ${existingUser.role}. Please select ${existingUser.role} login.` });
            }
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }
        if (user.verificationStatus === 'blocked') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'blocked' } });
            return res.status(403).json({ message: 'Your account has been blocked. Contact support.' });
        }
        if (user.role === 'worker' && user.verificationStatus !== 'approved') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'worker_not_approved', status: user.verificationStatus } });
            return res.status(403).json({ message: 'Your worker profile is pending admin approval.', status: user.verificationStatus });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'password_mismatch' } });
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }

        await logAuditEvent({ userId: user._id, role: user.role, action: 'login', req });

        const token = signToken(user._id, user.role);
        return res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, name: user.name, role: user.role, photo: user.photo, userId: user.userId || user.karigarId, karigarId: user.karigarId },
        });
    } catch { return res.status(500).json({ message: 'Login failed.' }); }
};

exports.loginWithOtp = async (req, res) => {
    try {
        const { role, mobile, otp } = req.body;
        if (!role || !mobile || !otp) {
            return res.status(400).json({ message: 'Role, mobile and OTP are required.' });
        }

        if (!['worker', 'client'].includes(role)) {
            return res.status(400).json({ message: 'OTP login is available only for worker and client.' });
        }

        const record = otpStore.get(mobile);
        if (!record || Date.now() > record.expiry || record.otp !== otp.trim()) {
            const existingUser = await User.findOne({ mobile, role }).select('_id role');
            await logAuditEvent({
                userId: existingUser?._id,
                role: existingUser?.role,
                action: 'failed_login',
                req,
                metadata: { method: 'otp', requestedRole: role, reason: 'invalid_or_expired_otp' },
            });
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }
        otpStore.delete(mobile);

        const user = await User.findOne({ mobile, role });
        if (!user) {
            const existingUser = await User.findOne({ mobile }).select('role');
            if (existingUser) {
                return res.status(401).json({ message: `This account is registered as ${existingUser.role}. Please select ${existingUser.role} login.` });
            }
            return res.status(404).json({ message: 'No account found for this mobile number.' });
        }

        if (user.verificationStatus === 'blocked') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { method: 'otp', reason: 'blocked' } });
            return res.status(403).json({ message: 'Your account has been blocked. Contact support.' });
        }
        if (user.role === 'worker' && user.verificationStatus !== 'approved') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { method: 'otp', reason: 'worker_not_approved', status: user.verificationStatus } });
            return res.status(403).json({ message: 'Your worker profile is pending admin approval.', status: user.verificationStatus });
        }

        await logAuditEvent({ userId: user._id, role: user.role, action: 'login', req, metadata: { method: 'otp' } });

        const token = signToken(user._id, user.role);
        return res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, name: user.name, role: user.role, photo: user.photo, userId: user.userId || user.karigarId, karigarId: user.karigarId },
        });
    } catch { return res.status(500).json({ message: 'Login failed.' }); }
};

// ── PASSWORD RESET ────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
    try {
        const { mobile, email } = req.body;
        if (!mobile && !email) return res.status(400).json({ message: 'Mobile or email is required.' });
        const user = await User.findOne(mobile ? { mobile } : { email });
        if (!user) return res.status(404).json({ message: 'No account found.' });

        const token = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
        user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
        await user.save({ validateBeforeSave: false });

        // In production: send reset link via SMS/Email
        console.log(`[PasswordReset] Token for ${mobile || email}: ${token}`);
        return res.json({ message: 'Password reset instructions sent.', resetToken: token });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.resetPassword = async (req, res) => {
    try {
        const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashed,
            resetPasswordExpire: { $gt: Date.now() },
        });
        if (!user) return res.status(400).json({ message: 'Reset token is invalid or has expired.' });
        const nextPassword = req.body.password || '';
        if (!validateStrongPassword(nextPassword).isValid)
            return res.status(400).json({ message: PASSWORD_POLICY_TEXT });
        user.password = nextPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return res.json({ message: 'Password reset successful. Please login.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};
