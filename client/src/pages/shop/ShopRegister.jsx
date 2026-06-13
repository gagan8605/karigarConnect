// client/src/pages/shop/ShopRegister.jsx
// FIXED: Input re-render bug resolved — all field components defined outside ShopRegister.
// IMPROVED: Professional 3-step design, proper file preview, image handling.

import React, { useState, useCallback, memo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import Header from '../../components/Header';
import { PASSWORD_POLICY_TEXT, isStrongPassword, getPasswordStrength, getPasswordChecks } from '../../constants/passwordPolicy';
import {
    Store, User, Phone, Mail, Lock, MapPin, FileText,
    CheckCircle, ChevronRight, ChevronLeft, Upload, Tag,
    Eye, EyeOff, Building2, Hash, Image as ImageIcon, X
} from 'lucide-react';

const SHOP_CATEGORIES = [
    'Electronics & Tools', 'Plumbing Supplies', 'Electrical Supplies',
    'Carpentry & Woodwork', 'Painting Supplies', 'Welding & Fabrication',
    'Masonry & Construction', 'Automobile Parts', 'Gardening & Landscaping',
    'Safety Equipment', 'Other',
];

const ID_TYPES = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Driving Licence', 'Passport'];

const DRAFT_KEY = 'shop_register_draft_v1';

// ── Stable field components (OUTSIDE ShopRegister) ───────────────────────────

const Field = memo(({ label, required, hint, error, children }) => (
    <div className="space-y-2">
        {label && (
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">
                {label}{required && <span className="text-red-400 ml-1">*</span>}
            </label>
        )}
        {children}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
));
Field.displayName = 'Field';

const Input = memo(({ type = 'text', placeholder, value, onChange, disabled,
    required, maxLength, prefix, rightSlot, error }) => (
    <div className="relative flex items-center">
        {prefix && (
            <span className="absolute left-4 text-gray-500 text-base font-medium select-none pointer-events-none z-10">
                {prefix}
            </span>
        )}
        <input
            type={type} placeholder={placeholder} value={value} onChange={onChange}
            disabled={disabled} required={required} maxLength={maxLength}
            className={[
                'w-full border-2 rounded-xl py-3.5 bg-white text-gray-900 text-base',
                'placeholder-gray-400 transition-all duration-200 font-medium',
                'focus:outline-none focus:ring-4 focus:ring-orange-50',
                prefix ? 'pl-14' : 'pl-4',
                rightSlot ? 'pr-12' : 'pr-4',
                disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : '',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-orange-400',
            ].join(' ')}
        />
        {rightSlot && <div className="absolute right-3 z-10">{rightSlot}</div>}
    </div>
));
Input.displayName = 'Input';

const Select = memo(({ value, onChange, options, placeholder, error }) => (
    <div className="relative">
        <select value={value} onChange={onChange}
            className={[
                'w-full border-2 rounded-xl py-3.5 pl-4 pr-10 bg-white text-base text-gray-900 appearance-none font-medium',
                'focus:outline-none focus:ring-4 focus:ring-orange-50 transition-all duration-200',
                error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-orange-400',
            ].join(' ')}>
            <option value="">{placeholder || '-- Select --'}</option>
            {options.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
));
Select.displayName = 'Select';

const FileField = memo(({ label, value, onChange, accept, hint, preview }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">{label}</label>
        <label className="flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:bg-orange-50/50 transition-all">
            {preview
                ? <img src={preview} className="w-16 h-16 rounded-lg object-cover border-2 border-orange-100" alt="preview" />
                : <div className="w-16 h-16 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Upload size={20} className="text-orange-400" />
                  </div>
            }
            <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-700 truncate">
                    {value ? value.name : 'Click to upload'}
                </p>
                {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
            </div>
            <input type="file" accept={accept || 'image/*,.pdf'} className="hidden" onChange={onChange} />
        </label>
    </div>
));
FileField.displayName = 'FileField';

const OtpRow = memo(({ label, verified, value, onChange, otp, onOtpChange,
    onSend, onVerify, otpSent, loading, disabled, cooldownSec = 0 }) => (
    <div className="space-y-2">
        <Field label={label}>
            <div className="flex gap-2">
                <div className="flex-1">
                    <Input placeholder={`Enter ${label.toLowerCase()}`}
                        value={value} onChange={onChange} disabled={disabled || verified} />
                </div>
                {!verified && (
                    <button type="button" onClick={onSend} disabled={loading || disabled || cooldownSec > 0}
                        className="shrink-0 px-4 py-3 bg-orange-100 hover:bg-orange-200 text-orange-700
                            rounded-xl text-xs font-black border border-orange-200 disabled:opacity-40 whitespace-nowrap transition-all">
                        {cooldownSec > 0 ? `Resend in ${cooldownSec}s` : (otpSent ? 'Resend' : 'Send OTP')}
                    </button>
                )}
                {verified && (
                    <div className="shrink-0 px-3 py-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-xs font-black text-green-600">Verified</span>
                    </div>
                )}
            </div>
        </Field>
        {otpSent && !verified && (
            <div className="flex gap-2">
                <Input placeholder="Enter OTP" value={otp} onChange={onOtpChange} maxLength={6} type="text" />
                <button type="button" onClick={onVerify} disabled={loading}
                    className="shrink-0 px-4 py-3 bg-green-500 hover:bg-green-600 text-white
                        rounded-xl text-xs font-black disabled:opacity-50 whitespace-nowrap transition-all">
                    Verify
                </button>
            </div>
        )}
    </div>
));
OtpRow.displayName = 'OtpRow';

// ── STEP INDICATOR ────────────────────────────────────────────────────────────
const StepDot = memo(({ n, current, label }) => (
    <div className="flex items-center gap-2">
        <div className={[
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all',
            n < current ? 'bg-green-500 text-white' :
            n === current ? 'bg-orange-500 text-white shadow-lg scale-110' :
            'bg-gray-100 text-gray-400',
        ].join(' ')}>
            {n < current ? <CheckCircle size={16} /> : n}
        </div>
        <span className={`text-xs font-semibold hidden sm:block ${n === current ? 'text-orange-600' : 'text-gray-400'}`}>
            {label}
        </span>
    </div>
));
StepDot.displayName = 'StepDot';

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const ShopRegister = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Contact verification state
    const [mobile, setMobile]             = useState('');
    const [mobileOtp, setMobileOtp]       = useState('');
    const [mobileOtpSent, setMobileOtpSent] = useState(false);
    const [mobileVerified, setMobileVerified] = useState(false);
    const [email, setEmail]               = useState('');
    const [emailOtp, setEmailOtp]         = useState('');
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [password, setPassword]         = useState('');
    const [confirmPwd, setConfirmPwd]     = useState('');
    const [showPwd, setShowPwd]           = useState(false);
    const [termsAgreed, setTermsAgreed]   = useState(false);
    const [legalPreview, setLegalPreview] = useState({ open: false, title: '', path: '' });

    // Shop details state
    const [ownerName, setOwnerName]       = useState('');
    const [shopName, setShopName]         = useState('');
    const [gstNumber, setGstNumber]       = useState('');
    const [category, setCategory]         = useState('');
    const [customCategory, setCustomCategory] = useState('');
    const [address, setAddress]           = useState('');
    const [city, setCity]                 = useState('');
    const [pincode, setPincode]           = useState('');
    const [locality, setLocality]         = useState('');

    // Location state
    const [latitude, setLatitude]         = useState(null);
    const [longitude, setLongitude]       = useState(null);
    const [locationError, setLocationError] = useState('');

    // Documents state
    const [idType, setIdType]             = useState('Aadhar Card');
    const [ownerPhoto, setOwnerPhoto]     = useState(null);
    const [idProof, setIdProof]           = useState(null);
    const [shopLogo, setShopLogo]         = useState(null);
    const [shopPhoto, setShopPhoto]       = useState(null);
    const [gstnCertificate, setGstnCertificate] = useState(null);
    const [ownerPhotoPreview, setOwnerPhotoPreview] = useState(null);
    const [shopLogoPreview, setShopLogoPreview]     = useState(null);
    const [shopPhotoPreview, setShopPhotoPreview]   = useState(null);

    // OTP cooldown state (per user, 30 seconds)
    const [mobileOtpCooldownSec, setMobileOtpCooldownSec] = useState(0);
    const [emailOtpCooldownSec, setEmailOtpCooldownSec] = useState(0);

    // ── Load draft from sessionStorage on mount ─────────────────────────────────
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);

            if (draft.mobile) setMobile(draft.mobile);
            if (draft.email) setEmail(draft.email);
            if (draft.password) setPassword(draft.password);
            if (draft.confirmPwd) setConfirmPwd(draft.confirmPwd);
            if (draft.mobileOtpSent) setMobileOtpSent(draft.mobileOtpSent);
            if (draft.emailOtpSent) setEmailOtpSent(draft.emailOtpSent);
            if (draft.mobileVerified) setMobileVerified(draft.mobileVerified);
            if (draft.emailVerified) setEmailVerified(draft.emailVerified);
            if (draft.termsAgreed) setTermsAgreed(draft.termsAgreed);
            if (draft.ownerName) setOwnerName(draft.ownerName);
            if (draft.shopName) setShopName(draft.shopName);
            if (draft.gstNumber) setGstNumber(draft.gstNumber);
            if (draft.category) setCategory(draft.category);
            if (draft.customCategory) setCustomCategory(draft.customCategory);
            if (draft.address) setAddress(draft.address);
            if (draft.city) setCity(draft.city);
            if (draft.pincode) setPincode(draft.pincode);
            if (draft.locality) setLocality(draft.locality);
            if (draft.idType) setIdType(draft.idType);
            if (draft.latitude) setLatitude(draft.latitude);
            if (draft.longitude) setLongitude(draft.longitude);
            if (draft.ownerPhotoPreview) setOwnerPhotoPreview(draft.ownerPhotoPreview);
            if (draft.shopLogoPreview) setShopLogoPreview(draft.shopLogoPreview);
            if (draft.shopPhotoPreview) setShopPhotoPreview(draft.shopPhotoPreview);
            if (typeof draft.step === 'number') setStep(draft.step);
        } catch {
            sessionStorage.removeItem(DRAFT_KEY);
        }
    }, []);

    // ── Save draft to sessionStorage on state changes ───────────────────────────
    useEffect(() => {
        const draft = {
            mobile, email, password, confirmPwd, mobileOtp, emailOtp,
            mobileOtpSent, emailOtpSent, mobileVerified, emailVerified,
            termsAgreed, ownerName, shopName, gstNumber, category, customCategory,
            address, city, pincode, locality, idType, latitude, longitude,
            ownerPhotoPreview, shopLogoPreview, shopPhotoPreview, step,
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [mobile, email, password, confirmPwd, mobileOtp, emailOtp, mobileOtpSent, emailOtpSent,
        mobileVerified, emailVerified, termsAgreed, ownerName, shopName, gstNumber, category,
        customCategory, address, city, pincode, locality, idType, latitude, longitude,
        ownerPhotoPreview, shopLogoPreview, shopPhotoPreview, step]);

    // OTP Cooldown timer for mobile (per user, 30 seconds)
    useEffect(() => {
        if (mobileOtpCooldownSec <= 0) return;
        const timer = setInterval(() => {
            setMobileOtpCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [mobileOtpCooldownSec]);

    // OTP Cooldown timer for email (per user, 30 seconds)
    useEffect(() => {
        if (emailOtpCooldownSec <= 0) return;
        const timer = setInterval(() => {
            setEmailOtpCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [emailOtpCooldownSec]);

    // Stable onChange handlers (no remount)
    const onMobile = useCallback(e => setMobile(e.target.value), []);
    const onMobileOtp = useCallback(e => setMobileOtp(e.target.value), []);
    const onEmail = useCallback(e => setEmail(e.target.value), []);
    const onEmailOtp = useCallback(e => setEmailOtp(e.target.value), []);
    const onPassword = useCallback(e => setPassword(e.target.value), []);
    const onConfirmPwd = useCallback(e => setConfirmPwd(e.target.value), []);
    const onOwnerName = useCallback(e => setOwnerName(e.target.value), []);
    const onShopName = useCallback(e => setShopName(e.target.value), []);
    const onGst = useCallback(e => setGstNumber(e.target.value), []);
    const onCategory = useCallback(e => setCategory(e.target.value), []);
    const onCustomCat = useCallback(e => setCustomCategory(e.target.value), []);
    const onAddress = useCallback(e => setAddress(e.target.value), []);
    const onCity = useCallback(e => setCity(e.target.value), []);
    const onPincode = useCallback(e => setPincode(e.target.value), []);
    const onLocality = useCallback(e => setLocality(e.target.value), []);
    const onIdType = useCallback(e => setIdType(e.target.value), []);

    const onOwnerPhoto = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setOwnerPhoto(f);
        setOwnerPhotoPreview(URL.createObjectURL(f));
    }, []);

    const onShopLogo = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setShopLogo(f);
        setShopLogoPreview(URL.createObjectURL(f));
    }, []);

    const onIdProof = useCallback(e => {
        const f = e.target.files[0];
        if (f) setIdProof(f);
    }, []);

    const onShopPhoto = useCallback(e => {
        const f = e.target.files[0];
        if (!f) return;
        setShopPhoto(f);
        setShopPhotoPreview(URL.createObjectURL(f));
    }, []);

    const onGstnCertificate = useCallback(e => {
        const f = e.target.files[0];
        if (f) setGstnCertificate(f);
    }, []);

    const passwordStrength = getPasswordStrength(password);
    const passwordChecks = getPasswordChecks(password);

    const captureLocation = useCallback(async () => {
        setLocationError('');
        if (!navigator.geolocation) {
            setLocationError('Geolocation not supported by your browser');
            return;
        }
        
        try {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    setLatitude(lat);
                    setLongitude(lon);
                    toast.success(`Location captured: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
                    
                    // Reverse geocoding to get address details
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
                        );
                        const data = await response.json();
                        
                        if (data.address) {
                            // Extract address components
                            const roadName = data.address.road || data.address.street || '';
                            const houseNum = data.address.house_number || '';
                            const village = data.address.village || data.address.hamlet || '';
                            const city = data.address.city || data.address.town || data.address.county || '';
                            const postcode = data.address.postcode || '';
                            
                            // Build full address
                            const fullAddress = [houseNum, roadName].filter(Boolean).join(', ');
                            
                            // Auto-fill the address fields
                            if (fullAddress) setAddress(fullAddress);
                            if (city) setCity(city);
                            if (village) setLocality(village);
                            if (postcode) setPincode(postcode);
                            
                            toast.success('Address details auto-filled from location!');
                        }
                    } catch (geoErr) {
                        console.log('Geocoding failed, but location captured:', geoErr);
                    }
                },
                error => {
                    let msg = 'Unable to get location';
                    if (error.code === error.PERMISSION_DENIED) msg = 'Permission denied. Enable location in browser settings.';
                    else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location information unavailable';
                    setLocationError(msg);
                    toast.error(msg);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } catch (err) {
            setLocationError('Error capturing location');
            toast.error('Error capturing location');
        }
    }, []);

    const togglePwd = useCallback(() => setShowPwd(v => !v), []);

    const openLegalPreview = useCallback((title, path) => {
        const previewPath = path.includes('?') ? `${path}&embed=1` : `${path}?embed=1`;
        setLegalPreview({ open: true, title, path: previewPath });
    }, []);

    const closeLegalPreview = useCallback(() => {
        setLegalPreview({ open: false, title: '', path: '' });
    }, []);

    // OTP actions
    const sendMobileOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile.');
        if (mobileOtpCooldownSec > 0) return toast.error(`Please wait ${mobileOtpCooldownSec}s before requesting another OTP.`);
        setLoading(true);
        try {
            const res = await api.shopSendMobileOtp({ mobile });
            setMobileOtpSent(true);
            setMobileOtpCooldownSec(30);
            toast.success('OTP sent to mobile!');
        } catch (e) {
            const retryAfter = Number(e?.response?.data?.retryAfterSeconds || 0);
            const msg = e.response?.data?.message || 'Failed.';
            if (retryAfter > 0) setMobileOtpCooldownSec(retryAfter);
            if (e.response?.data?.alreadyRegistered) {
                toast.error(msg);
            } else {
                toast.error(msg);
            }
        }
        finally { setLoading(false); }
    }, [mobile, mobileOtpCooldownSec]);

    const verifyMobileOtp = useCallback(async () => {
        setLoading(true);
        try {
            await api.shopVerifyMobileOtp({ mobile, otp: mobileOtp });
            setMobileVerified(true);
            toast.success('Mobile verified!');
        } catch (e) { toast.error(e.response?.data?.message || 'Incorrect OTP.'); }
        finally { setLoading(false); }
    }, [mobile, mobileOtp]);

    const sendEmailOtp = useCallback(async () => {
        if (!email) return toast.error('Enter email first.');
        if (emailOtpCooldownSec > 0) return toast.error(`Please wait ${emailOtpCooldownSec}s before requesting another OTP.`);
        setLoading(true);
        try {
            const res = await api.shopSendEmailOtp({ email: email.trim(), mobile: mobile.trim() });
            if (res?.data?.devFallback) {
                setEmailVerified(true);
                setEmailOtpSent(true);
                toast.success(res.data.message || 'Email verification bypassed in development.');
                return;
            }
            setEmailOtpSent(true);
            setEmailOtpCooldownSec(30);
            toast.success('OTP sent to email!');
        } catch (e) {
            const retryAfter = Number(e?.response?.data?.retryAfterSeconds || 0);
            const msg = e.response?.data?.message || 'Failed.';
            if (retryAfter > 0) setEmailOtpCooldownSec(retryAfter);
            if (import.meta.env.DEV && /unrecognised ip address|unrecognized ip address|authorised ip|authorized ip/i.test(msg)) {
                setEmailVerified(true);
                setEmailOtpSent(true);
                toast.success('Email verification bypassed in development because Brevo rejected the current IP.');
                return;
            }
            toast.error(msg);
        }
        finally { setLoading(false); }
    }, [email, mobile, emailOtpCooldownSec]);

    const verifyEmailOtp = useCallback(async () => {
        setLoading(true);
        try {
            await api.shopVerifyEmailOtp({ email: email.trim(), mobile: mobile.trim(), otp: emailOtp.trim() });
            setEmailVerified(true);
            toast.success('Email verified!');
        } catch (e) { toast.error(e.response?.data?.message || 'Incorrect OTP.'); }
        finally { setLoading(false); }
    }, [email, mobile, emailOtp]);

    const goStep2 = useCallback(() => {
        // Free navigation - no validation required
        setStep(2);
    }, []);

    const goStep3 = useCallback(() => {
        // Free navigation - no validation required
        setStep(3);
    }, []);

    const handleSubmit = useCallback(async () => {
        // Validate all required fields before submission
        if (!termsAgreed) return toast.error('Please agree to Terms and Conditions and Privacy Policy.');
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile number.');
        if (!email) return toast.error('Enter email address.');
        if (!mobileVerified) return toast.error('Please verify your mobile number.');
        if (!emailVerified) return toast.error('Please verify your email address.');
        if (!password || !isStrongPassword(password)) return toast.error(PASSWORD_POLICY_TEXT);
        if (password !== confirmPwd) return toast.error('Passwords do not match.');
        if (!ownerName) return toast.error('Enter owner name.');
        if (!shopName) return toast.error('Enter shop name.');
        if (!address) return toast.error('Enter full address.');
        if (!city) return toast.error('Enter city name.');
        if (!category) return toast.error('Select shop category.');
        if (category === 'Other' && !customCategory) return toast.error('Enter custom category.');
        if (!ownerPhoto) return toast.error('Upload owner profile photo.');
        if (!idProof) return toast.error('Upload ID proof document.');
        
        setLoading(true);
        try {
            const fd = new FormData();
            const finalCat = category === 'Other' ? customCategory : category;
            const fields = { ownerName, mobile, email, password, shopName, gstNumber,
                             address, city, pincode, locality, idType, category: finalCat,
                             latitude: latitude || '', longitude: longitude || '' };
            Object.entries(fields).forEach(([k, v]) => fd.append(k, v || ''));
            if (ownerPhoto) fd.append('ownerPhoto', ownerPhoto);
            if (idProof)    fd.append('idProof', idProof);
            if (shopLogo)   fd.append('shopLogo', shopLogo);
            if (shopPhoto)  fd.append('shopPhoto', shopPhoto);
            if (gstnCertificate) fd.append('gstnCertificate', gstnCertificate);

            await api.shopRegister(fd);
            sessionStorage.removeItem(DRAFT_KEY); // Clear draft after successful registration
            setSubmitted(true);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Registration failed.');
        } finally { setLoading(false); }
    }, [termsAgreed, ownerName, mobile, email, password, confirmPwd, shopName, gstNumber, address, city,
        pincode, locality, idType, category, customCategory, ownerPhoto, idProof, shopLogo,
        shopPhoto, gstnCertificate, latitude, longitude, mobileVerified, emailVerified]);

    // ── SUCCESS SCREEN ──────────────────────────────────────────────────────
    if (submitted) return (
        <>
            <Header />
            <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-8 px-4 flex items-center justify-center">
                <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-green-100">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                        <CheckCircle size={48} className="text-green-500" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 mb-3">Registration Submitted!</h2>
                    <p className="text-gray-600 mb-2">Your shop <span className="font-bold text-gray-800">"{shopName}"</span> has been submitted for review.</p>
                    <p className="text-orange-600 font-bold text-base mb-8 bg-orange-50 rounded-xl p-4">
                        ⏰ We will contact you within 24 hours with the approval status.
                    </p>
                    <Link to="/login"
                        className="block w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-black hover:shadow-lg transition-all text-lg">
                        Back to Login
                    </Link>
                </div>
            </div>
        </>
    );

    const STEPS = ['Verify Contact', 'Shop Details', 'Documents'];

    return (
        <>
            <Header />
            <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-8 px-4">
                <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-black/10"/>
                        <div className="relative">
                            <Link to="/register" className="inline-flex items-center text-white/90 hover:text-white mb-4">
                                <ChevronLeft className="h-5 w-5 mr-2"/>Back
                            </Link>
                            <div className="flex items-center justify-center mb-4">
                                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mr-4 backdrop-blur-sm">
                                    <Store className="h-8 w-8 text-white"/>
                                </div>
                                <div>
                                    <h1 className="text-4xl font-bold mb-2">Create Your Shop Account</h1>
                                    <p className="text-orange-100 text-lg">Join KarigarConnect's trusted platform to serve workers and clients</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b border-orange-200">
                        <div className="flex items-center justify-start sm:justify-center gap-3 overflow-x-auto pb-2">
                            {STEPS.map((label, i) => {
                                const isActive = step === i + 1;
                                const isDone = step > i + 1;

                                return (
                                    <React.Fragment key={label}>
                                        <button
                                            type="button"
                                            onClick={() => setStep(i + 1)}
                                            className="flex items-center gap-2 focus:outline-none"
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                                                    isDone
                                                        ? 'bg-green-500 text-white'
                                                        : isActive
                                                        ? 'bg-orange-500 text-white shadow-lg scale-110'
                                                        : 'bg-white text-orange-500 border-2 border-orange-200'
                                                }`}
                                            >
                                                {isDone ? <CheckCircle className="h-4 w-4" /> : i + 1}
                                            </div>
                                            <span className={`text-xs font-semibold whitespace-nowrap ${isActive ? 'text-orange-700' : isDone ? 'text-green-700' : 'text-gray-500'}`}>
                                                {label}
                                            </span>
                                        </button>

                                        {i < STEPS.length - 1 && (
                                            <div className={`h-0.5 w-8 sm:w-12 ${step > i + 1 ? 'bg-green-400' : 'bg-orange-200'}`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-8 space-y-6">
                        {/* ── STEP 1 ── */}
                        {step === 1 && (
                            <>
                                <OtpRow label="Mobile Number"
                                    value={mobile} onChange={onMobile}
                                    otp={mobileOtp} onOtpChange={onMobileOtp}
                                    onSend={sendMobileOtp} onVerify={verifyMobileOtp}
                                    otpSent={mobileOtpSent} verified={mobileVerified}
                                    loading={loading} cooldownSec={mobileOtpCooldownSec} />

                                <OtpRow label="Email Address"
                                    value={email} onChange={onEmail}
                                    otp={emailOtp} onOtpChange={onEmailOtp}
                                    onSend={sendEmailOtp} onVerify={verifyEmailOtp}
                                    otpSent={emailOtpSent} verified={emailVerified}
                                    loading={loading} cooldownSec={emailOtpCooldownSec} />

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Password" required>
                                        <Input type={showPwd ? 'text' : 'password'}
                                            placeholder="Strong password"
                                            value={password} onChange={onPassword} required
                                            rightSlot={
                                                <button type="button" onClick={togglePwd}
                                                    className="text-gray-400 hover:text-gray-600 p-1">
                                                    {showPwd ? <EyeOff size={14}/> : <Eye size={14}/>}
                                                </button>
                                            } />
                                        <p className="text-xs text-gray-500 mt-1">{PASSWORD_POLICY_TEXT}</p>
                                        {password && (
                                            <div className="mt-2 space-y-2">
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${passwordStrength.color} rounded-full transition-all duration-300`}
                                                        style={{ width: passwordStrength.width }}
                                                    />
                                                </div>
                                                <p className={`text-xs font-semibold ${passwordStrength.text}`}>
                                                    Strength: {passwordStrength.label}
                                                </p>
                                                <div className="space-y-1 text-[11px]">
                                                    <p className={passwordChecks.minLength ? 'text-green-600' : 'text-red-500'}>
                                                        {passwordChecks.minLength ? '✓' : '✗'} At least 7 characters
                                                    </p>
                                                    <p className={passwordChecks.uppercase ? 'text-green-600' : 'text-red-500'}>
                                                        {passwordChecks.uppercase ? '✓' : '✗'} One uppercase letter
                                                    </p>
                                                    <p className={passwordChecks.lowercase ? 'text-green-600' : 'text-red-500'}>
                                                        {passwordChecks.lowercase ? '✓' : '✗'} One lowercase letter
                                                    </p>
                                                    <p className={passwordChecks.number ? 'text-green-600' : 'text-red-500'}>
                                                        {passwordChecks.number ? '✓' : '✗'} One number
                                                    </p>
                                                    <p className={passwordChecks.special ? 'text-green-600' : 'text-red-500'}>
                                                        {passwordChecks.special ? '✓' : '✗'} One special character
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </Field>
                                    <Field label="Confirm Password" required>
                                        <Input type="password" placeholder="Re-enter"
                                            value={confirmPwd} onChange={onConfirmPwd} required />
                                        {confirmPwd && (
                                            <p className={`text-xs mt-1 ${password === confirmPwd ? 'text-green-600' : 'text-red-500'}`}>
                                                {password === confirmPwd ? '✓ Passwords match' : '✗ Passwords do not match'}
                                            </p>
                                        )}
                                    </Field>
                                </div>

                                <button onClick={goStep2}
                                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg transition-all">
                                    Continue <ChevronRight size={20} />
                                </button>
                            </>
                        )}

                        {/* ── STEP 2 ── */}
                        {step === 2 && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Owner Name" required>
                                        <Input placeholder="Full name" value={ownerName} onChange={onOwnerName} required />
                                    </Field>
                                    <Field label="Shop Name" required>
                                        <Input placeholder="Shop name" value={shopName} onChange={onShopName} required />
                                    </Field>
                                </div>

                                <Field label="GST Number">
                                    <Input placeholder="Optional" value={gstNumber} onChange={onGst} />
                                </Field>

                                <Field label="Shop Category" required>
                                    <Select value={category} onChange={onCategory}
                                        options={SHOP_CATEGORIES} placeholder="-- Select Category --" />
                                </Field>

                                {category === 'Other' && (
                                    <Field label="Custom Category" required>
                                        <Input placeholder="Enter your category"
                                            value={customCategory} onChange={onCustomCat} required />
                                    </Field>
                                )}

                                <Field label="Full Address" required>
                                    <Input placeholder="Street / Building / Area"
                                        value={address} onChange={onAddress} required />
                                </Field>

                                <div className="grid grid-cols-3 gap-3">
                                    <Field label="City" required>
                                        <Input placeholder="City" value={city} onChange={onCity} required />
                                    </Field>
                                    <Field label="Pincode">
                                        <Input placeholder="Pincode" value={pincode} onChange={onPincode} maxLength={6} />
                                    </Field>
                                    <Field label="Locality">
                                        <Input placeholder="Area" value={locality} onChange={onLocality} />
                                    </Field>
                                </div>

                                <button type="button" onClick={captureLocation}
                                    className="w-full border-2 border-blue-400 text-blue-600 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all">
                                    {latitude && longitude ? (
                                        <>
                                            <span className="text-green-600">✓</span>
                                            Location Captured: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                                        </>
                                    ) : (
                                        <>
                                            <MapPin size={16} />
                                            Capture Shop Location
                                        </>
                                    )}
                                </button>

                                {locationError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                                        {locationError}
                                    </div>
                                )}

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(1)}
                                        className="flex-1 border-2 border-orange-200 text-orange-600 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-50 transition-all">
                                        <ChevronLeft size={20} /> Back
                                    </button>
                                    <button onClick={goStep3}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg transition-all">
                                        Continue <ChevronRight size={20} />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* ── STEP 3 ── */}
                        {step === 3 && (
                            <>
                                <FileField label="Owner Profile Photo"
                                    value={ownerPhoto} onChange={onOwnerPhoto}
                                    accept="image/*" preview={ownerPhotoPreview}
                                    hint="JPG, PNG up to 5MB" />

                                <Field label="ID Proof Type" required>
                                    <Select value={idType} onChange={onIdType} options={ID_TYPES} />
                                </Field>

                                <FileField label="ID Proof Document"
                                    value={idProof} onChange={onIdProof}
                                    accept="image/*,.pdf"
                                    hint="Upload clear photo or scanned PDF" />

                                <FileField label="Shop Logo (optional)"
                                    value={shopLogo} onChange={onShopLogo}
                                    accept="image/*" preview={shopLogoPreview}
                                    hint="Square image recommended" />

                                <FileField label="Shop Photo"
                                    value={shopPhoto} onChange={onShopPhoto}
                                    accept="image/*" preview={shopPhotoPreview}
                                    hint="A clear photo of your shop front" />

                                <FileField label="GSTN Certificate (optional)"
                                    value={gstnCertificate} onChange={onGstnCertificate}
                                    accept="image/*,.pdf" 
                                    hint="Upload GSTN certificate if available" />

                                {/* Terms & Conditions Checkbox */}
                                <div className="border-2 border-orange-200 rounded-xl p-4 bg-orange-50/50">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={termsAgreed} 
                                            onChange={(e) => setTermsAgreed(e.target.checked)}
                                            className="w-5 h-5 mt-1 accent-orange-500 cursor-pointer border-2 border-orange-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700 leading-relaxed">
                                            I agree to the{' '}
                                            <button 
                                                type="button"
                                                onClick={() => openLegalPreview('Terms & Conditions', '/terms-and-conditions')}
                                                className="text-orange-600 font-bold hover:underline"
                                            >
                                                Terms & Conditions
                                            </button>
                                            {' '}and{' '}
                                            <button 
                                                type="button"
                                                onClick={() => openLegalPreview('Privacy Policy', '/privacy-policy')}
                                                className="text-orange-600 font-bold hover:underline"
                                            >
                                                Privacy Policy
                                            </button>
                                            {' '}of KarigarConnect. <span className="text-red-500 font-bold">*</span>
                                        </span>
                                    </label>
                                </div>

                                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-xs text-orange-700 leading-relaxed">
                                    By submitting, you confirm that all information is accurate. Admin will review within 24 hours. You'll be notified via SMS once approved.
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(2)}
                                        className="flex-1 border-2 border-orange-200 text-orange-600 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-orange-50 transition-all">
                                        <ChevronLeft size={20} /> Back
                                    </button>
                                    <button onClick={handleSubmit} disabled={loading || !termsAgreed}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50">
                                        {loading ? (
                                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                                        ) : 'Submit for Approval'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-8 py-5 border-t border-orange-200 text-center">
                        <p className="text-sm text-gray-600">
                            Already registered?{' '}
                            <Link to="/login" className="text-orange-600 font-bold hover:underline">Login here</Link>
                        </p>
                    </div>
                </div>
            </div>

            {legalPreview.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={closeLegalPreview}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="h-14 border-b border-orange-100 px-4 sm:px-5 flex items-center justify-between bg-orange-50">
                            <h3 className="text-sm sm:text-base font-black text-orange-700 truncate">{legalPreview.title}</h3>
                            <button type="button" onClick={closeLegalPreview} className="w-9 h-9 rounded-full bg-white border border-orange-200 text-orange-700 hover:bg-orange-100 flex items-center justify-center" aria-label="Close legal preview">
                                <X size={18} />
                            </button>
                        </div>
                        <iframe title={legalPreview.title} src={legalPreview.path} className="w-full h-[calc(85vh-56px)] border-0 bg-white" />
                    </div>
                </div>
            )}
        </>
    );
};

export default ShopRegister;
