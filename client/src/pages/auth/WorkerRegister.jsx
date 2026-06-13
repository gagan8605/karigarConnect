// client/src/pages/auth/WorkerRegister.jsx
// CHANGE: Added Section 4 — "Face Verification" (between References and Submit).
// All other fields, OTP flow, and references are UNCHANGED.

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import FaceVerification, { dataURLtoBlob } from './FaceVerification';
import LocationMapPicker from '../../components/LocationMapPicker';
import { PASSWORD_POLICY_TEXT, getPasswordStrength, isStrongPassword } from '../../constants/passwordPolicy';
import skillList from '../../constants/skillList';
import {
    Calendar, Smartphone, User, Shield, Mail, MapPin, Award, Users,
    ArrowLeft, CheckCircle, FileText, Camera, Upload, Clock, Image as ImageIcon, Eye, EyeOff, X,
} from 'lucide-react';

const documentTypes = ["Aadhar Card","PAN Card","Voter ID","Driving License","Passport"];
const travelMethods = [
    { value: 'cycle', label: 'Cycle' },
    { value: 'bike', label: 'Bike' },
    { value: 'bus', label: 'Bus' },
    { value: 'other', label: 'Other' },
];
const DRAFT_KEY = 'worker_register_draft_v1';
const MAX_WORKER_SKILLS = 4;
const WORKER_TERMS_GATE_KEY = 'kc_worker_terms_gate_v1';

const getIdNumberMeta = (idType) => {
    if (idType === 'PAN Card') {
        return {
            label: 'PAN Number *',
            placeholder: 'e.g. ABCDE1234F',
            maxLength: 10,
            inputMode: 'text',
        };
    }

    if (idType === 'Aadhar Card') {
        return {
            label: 'Aadhaar Number *',
            placeholder: '12-digit Aadhaar number',
            maxLength: 12,
            inputMode: 'numeric',
        };
    }

    return {
        label: 'ID Number *',
        placeholder: 'Enter selected ID number',
        maxLength: 24,
        inputMode: 'text',
    };
};

const calculateAgeFromDob = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
    return age;
};

const WorkerRegister = () => {
    const [formData, setFormData] = useState({
        name:'', dob:'', phoneType:'Smartphone', mobile:'', email:'', password:'', confirmPassword:'',
        city:'', pincode:'', locality:'', fullAddress:'', village:'', latitude:'', longitude:'', experience:'',
        idNumber:'', gender:'Male', eShramNumber:'', otherSkill:'', otherSkillSecondary:'',
        emergencyContactName:'', emergencyContactMobile:'', idDocumentType:'Aadhar Card', travelMethod: 'other',
    });
    const [files, setFiles] = useState({
        photo:null, idProof:null, eShramCard:null, skillCertificates:[], portfolioPhotos:[],
    });
    const [skills,       setSkills]        = useState({});
    const [references,   setReferences]    = useState([{ name:'', contact:'' }]);
    const [otp,          setOtp]           = useState('');
    const [mobileVerified, setMobileVerified] = useState(false);
    const [otpSent,      setOtpSent]       = useState(false);
    const [otpTimer,     setOtpTimer]      = useState(0);
    const [activeSection,setActiveSection] = useState(0);
    const [agreedToTerms,setAgreedToTerms] = useState(false);
    const [ageConsent,   setAgeConsent]    = useState(false);

    // ── Face verification state ───────────────────────────────────────────────
    const [showFaceVerification, setShowFaceVerification] = useState(false);
    const [livePhotoData,        setLivePhotoData]        = useState(null); // dataURL
    const [checkingSimilarity,   setCheckingSimilarity]   = useState(false);
    const [faceMatchPassed,      setFaceMatchPassed]      = useState(false);
    const [faceMessage,          setFaceMessage]          = useState('');
    const [showPassword,         setShowPassword]         = useState(false);
    const [showConfirmPassword,  setShowConfirmPassword]  = useState(false);
    const [locationError,        setLocationError]        = useState('');
    const [legalPreview,         setLegalPreview]         = useState({ open: false, title: '', path: '' });
    const [showTermsGate,        setShowTermsGate]        = useState(false);
    const [termsGateAccepted,    setTermsGateAccepted]    = useState(false);

    const navigate = useNavigate();
    const strength = getPasswordStrength(formData.password);
    const idNumberMeta = getIdNumberMeta(formData.idDocumentType);
    const computedAge = calculateAgeFromDob(formData.dob);

    useEffect(() => {
        let interval;
        if (otpTimer > 0) interval = setInterval(() => setOtpTimer(p => p - 1), 1000);
        return () => clearInterval(interval);
    }, [otpTimer]);

    useEffect(() => {
        const accepted = localStorage.getItem(WORKER_TERMS_GATE_KEY) === 'accepted';
        if (!accepted) {
            setShowTermsGate(true);
            openLegalPreview('Terms and Conditions', '/terms-and-conditions');
        }
    }, []);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DRAFT_KEY);
            if (!raw) return;
            const draft = JSON.parse(raw);

            if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }));
            if (draft.skills) setSkills(draft.skills);
            if (Array.isArray(draft.references) && draft.references.length) setReferences(draft.references);
            if (typeof draft.mobileVerified === 'boolean') setMobileVerified(draft.mobileVerified);
            if (typeof draft.otpSent === 'boolean') setOtpSent(draft.otpSent);
            if (typeof draft.activeSection === 'number') setActiveSection(draft.activeSection);
            if (typeof draft.agreedToTerms === 'boolean') setAgreedToTerms(draft.agreedToTerms);
            if (typeof draft.ageConsent === 'boolean') setAgeConsent(draft.ageConsent);
            if (draft.livePhotoData) setLivePhotoData(draft.livePhotoData);
            if (typeof draft.faceMatchPassed === 'boolean') setFaceMatchPassed(draft.faceMatchPassed);
            if (draft.faceMessage) setFaceMessage(draft.faceMessage);
        } catch {
            sessionStorage.removeItem(DRAFT_KEY);
        }
    }, []);

    useEffect(() => {
        const draft = {
            formData,
            skills,
            references,
            mobileVerified,
            otpSent,
            activeSection,
            agreedToTerms,
            ageConsent,
            livePhotoData,
            faceMatchPassed,
            faceMessage,
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, [
        formData,
        skills,
        references,
        mobileVerified,
        otpSent,
        activeSection,
        agreedToTerms,
        ageConsent,
        livePhotoData,
        faceMatchPassed,
        faceMessage,
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name === 'idDocumentType') {
            setFormData((prev) => ({ ...prev, idDocumentType: value, idNumber: '' }));
            return;
        }

        if (name === 'idNumber') {
            if (formData.idDocumentType === 'Aadhar Card') {
                const numeric = value.replace(/\D/g, '').slice(0, 12);
                setFormData((prev) => ({ ...prev, idNumber: numeric }));
                return;
            }

            if (formData.idDocumentType === 'PAN Card') {
                const pan = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                setFormData((prev) => ({ ...prev, idNumber: pan }));
                return;
            }
        }

        setFormData((prev) => ({ ...prev, [name]: value }));
    };
    const handleFileChange = e => {
        const { name, files: sel } = e.target;
        if (!sel) return;
        if (name === 'skillCertificates') {
            const selected = Array.from(sel);
            const limited = selected.slice(0, 3);
            if (selected.length > 3) {
                toast.error('Maximum 3 skill certificates are allowed.');
            }
            setFiles(p => ({ ...p, skillCertificates: limited }));
        } else if (name === 'portfolioPhotos') {
            const selected = Array.from(sel);
            const limited = selected.slice(0, 4);
            if (selected.length > 4) {
                toast.error('Maximum 4 portfolio photos are allowed.');
            }
            setFiles(p => ({ ...p, portfolioPhotos: limited }));
        } else {
            setFiles(p => ({ ...p, [name]: sel[0] }));
        }

        if (name === 'idProof') {
            setFaceMatchPassed(false);
            setFaceMessage('ID proof changed. Please run face verification again.');
        }
    };

    const handleSkillCheckbox = e => {
        const { name, checked } = e.target;
        if (checked) {
            setSkills((prev) => {
                if (prev[name]) return prev;
                const selectedCount = Object.keys(prev).length;
                if (selectedCount >= MAX_WORKER_SKILLS) {
                    toast.error(`You can select maximum ${MAX_WORKER_SKILLS} skills.`);
                    return prev;
                }
                return { ...prev, [name]: { name, isPrimary: selectedCount === 0 } };
            });
            return;
        }

        setSkills((prev) => {
            if (!prev[name]) return prev;
            const next = { ...prev };
            const wasPrimary = !!next[name]?.isPrimary;
            delete next[name];

            if (wasPrimary) {
                const firstRemaining = Object.keys(next)[0];
                if (firstRemaining) {
                    next[firstRemaining] = { ...next[firstRemaining], isPrimary: true };
                }
            }
            return next;
        });
    };
    const handlePrimarySkill = (skillName) => {
        setSkills((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((key) => {
                next[key] = { ...next[key], isPrimary: key === skillName };
            });
            return next;
        });
    };

    const handleReferenceChange = (i, e) => {
        const v = [...references]; v[i][e.target.name] = e.target.value; setReferences(v);
    };
    const addReference    = () => setReferences([...references, { name:'', contact:'' }]);
    const removeReference = i  => { if (references.length > 1) { const v = [...references]; v.splice(i,1); setReferences(v); } };

    const handleSendOtp = async () => {
        if (!formData.mobile || formData.mobile.length !== 10) return toast.error('Valid 10-digit mobile required');
        const id = toast.loading('Checking & sending OTP…');
        try {
            await api.sendOtp({ mobile: formData.mobile, type: 'worker' });
            setOtpSent(true);
            setOtpTimer(59);
            toast.success('OTP sent!', { id });
        } catch (err) {
            const data = err.response?.data;
            if (data?.alreadyRegistered) {
                toast.error(data.message || 'Already registered. Please login.', { id, duration: 5000 });
            } else {
                toast.error(err.response?.data?.message || 'Failed to send OTP', { id });
            }
        }
    };
    const handleVerifyOtp = async () => {
        if (!otp) return toast.error('Enter OTP');
        const id = toast.loading('Verifying…');
        try { await api.verifyOtp({ identifier: formData.mobile, otp }); setMobileVerified(true); setOtpTimer(0); toast.success('Mobile verified!', { id }); }
        catch { toast.error('Invalid OTP', { id }); }
    };

    const formatTime = s => `0:${s < 10 ? '0' : ''}${s}`;

    const openLegalPreview = (title, path) => {
        const previewPath = path.includes('?') ? `${path}&embed=1` : `${path}?embed=1`;
        setLegalPreview({ open: true, title, path: previewPath });
    };

    const closeLegalPreview = () => {
        setLegalPreview({ open: false, title: '', path: '' });
    };

    const acceptTermsGate = () => {
        if (!termsGateAccepted) {
            toast.error('Please confirm after reviewing terms and privacy policy.');
            return;
        }
        localStorage.setItem(WORKER_TERMS_GATE_KEY, 'accepted');
        setShowTermsGate(false);
        closeLegalPreview();
    };

    const handleMapLocationSelected = (locationInfo) => {
        setFormData((prev) => ({
            ...prev,
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            fullAddress: locationInfo.fullAddress || prev.fullAddress,
            city: locationInfo.city || prev.city,
            village: locationInfo.village || prev.village,
            locality: locationInfo.locality || prev.locality,
            pincode: locationInfo.pincode || prev.pincode,
        }));
    };

    const runFaceSimilarityCheck = async (photoDataUrl) => {
        if (!files.idProof || !photoDataUrl) return;

        setCheckingSimilarity(true);
        setFaceMessage('Checking face match with your uploaded ID...');
        setFaceMatchPassed(false);

        try {
            const fd = new FormData();
            fd.append('idProof', files.idProof);
            fd.append('livePhoto', dataURLtoBlob(photoDataUrl), 'live_face.jpg');

            const { data } = await api.previewFaceSimilarity(fd);
            setFaceMatchPassed(!!data.passed);
            setFaceMessage(data.message || (data.passed ? 'Congratulations, face match.' : 'Face not match with ID.'));
            if (data.passed) toast.success('Congratulations, face match.');
            else toast.error('Face not match with ID. Please retry verification.');
        } catch (err) {
            setFaceMessage(err.response?.data?.message || 'Could not verify face match right now.');
            toast.error(err.response?.data?.message || 'Failed to verify face match.');
            setFaceMatchPassed(false);
        } finally {
            setCheckingSimilarity(false);
        }
    };

    // ── Face verification callback ────────────────────────────────────────────
    const handleFaceComplete = async ({ photoDataUrl }) => {
        setLivePhotoData(photoDataUrl);
        setShowFaceVerification(false);
        await runFaceSimilarityCheck(photoDataUrl);
    };

    // ── Final submit ──────────────────────────────────────────────────────────
    const handleSubmit = async e => {
        e.preventDefault();
        if (!mobileVerified)    return toast.error('Verify mobile first');
        if (!agreedToTerms)     return toast.error('Agree to Terms and Conditions');
        if (!ageConsent)        return toast.error('Please confirm you are 18+ and provide consent');
        if (!livePhotoData)     return toast.error('Complete face verification first');
        if (!faceMatchPassed)   return toast.error('Face not match with ID. Please retry face verification.');
        if (formData.password !== formData.confirmPassword) return toast.error("Passwords don't match");
        if (!isStrongPassword(formData.password)) return toast.error(PASSWORD_POLICY_TEXT);
        if (computedAge === null || computedAge < 18)
            return toast.error('Must be at least 18 years old');
        if (!formData.idNumber?.trim()) return toast.error('ID number is required');
        if (formData.idDocumentType === 'Aadhar Card' && !/^\d{12}$/.test(formData.idNumber.trim())) {
            return toast.error('Enter a valid 12-digit Aadhaar number');
        }
        if (formData.idDocumentType === 'PAN Card' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(formData.idNumber.trim().toUpperCase())) {
            return toast.error('Enter a valid PAN number (example: ABCDE1234F)');
        }

        const selectedSkills = Object.values(skills || {}).filter((row) => row?.name);
        if (!selectedSkills.length) return toast.error('Please select at least one skill.');
        if (selectedSkills.length > MAX_WORKER_SKILLS) return toast.error(`You can select maximum ${MAX_WORKER_SKILLS} skills.`);
        const selectedPrimary = selectedSkills.find((row) => row?.isPrimary);
        if (!selectedPrimary) return toast.error('Please mark one selected skill as primary.');
        const customSkills = [formData.otherSkill, formData.otherSkillSecondary]
            .map((value) => value.trim())
            .filter(Boolean);

        if (skills.Other && customSkills.length === 0) {
            return toast.error('Please specify at least one Other skill.');
        }

        const duplicateCustomSkill = customSkills.find((value, index) =>
            customSkills.findIndex((inner) => inner.toLowerCase() === value.toLowerCase()) !== index
        );
        if (duplicateCustomSkill) {
            return toast.error('Custom Other skills must be different.');
        }

        const finalSkills = [];
        selectedSkills.forEach((row) => {
            if (row.name === 'Other') {
                if (customSkills[0]) {
                    finalSkills.push({ name: customSkills[0], isPrimary: !!row.isPrimary });
                }
                if (customSkills[1] && finalSkills.length < MAX_WORKER_SKILLS) {
                    finalSkills.push({ name: customSkills[1], isPrimary: false });
                }
                return;
            }
            finalSkills.push({ name: row.name, isPrimary: !!row.isPrimary });
        });

        if (finalSkills.length > MAX_WORKER_SKILLS) {
            return toast.error(`You can select maximum ${MAX_WORKER_SKILLS} skills.`);
        }

        if (!finalSkills.some((row) => row.isPrimary) && finalSkills.length > 0) {
            finalSkills[0].isPrimary = true;
        }
        const primarySkill = (finalSkills.find((row) => row.isPrimary) || finalSkills[0])?.name || '';

        const data = new FormData();
        Object.keys(formData).forEach(k => data.append(k, formData[k]));
        data.append('ageConsent', String(ageConsent));
        data.append('skills',     JSON.stringify(finalSkills));
        data.append('primarySkill', primarySkill);
        data.append('references', JSON.stringify(references));
        if (files.photo)     data.append('photo',     files.photo);
        if (files.idProof)   data.append('idProof',   files.idProof);
        if (files.eShramCard)data.append('eShramCard',files.eShramCard);
        files.skillCertificates.forEach(f => data.append('skillCertificates', f));
        files.portfolioPhotos.forEach(f   => data.append('portfolioPhotos',   f));

        // Attach live face photo
        const blob = dataURLtoBlob(livePhotoData);
        data.append('livePhoto', blob, 'live_face.jpg');

        const id = toast.loading('Submitting your profile…');
        try {
            await api.registerWorker(data);
            toast.success('Registration submitted! Your profile is under review.', { id });
            sessionStorage.removeItem(DRAFT_KEY);
            navigate('/notification');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed', { id });
        }
    };

    // ── Sections ──────────────────────────────────────────────────────────────
    const sections = [
        { title:'Personal Details',   icon:User,   completed: formData.name && formData.dob && formData.mobile && mobileVerified },
        { title:'Skills & Experience',icon:Award,  completed: Object.keys(skills).length > 0 },
        { title:'Address & Documents',icon:MapPin,  completed: formData.fullAddress && formData.city && formData.village && formData.pincode && formData.latitude && formData.longitude && files.photo && files.idProof },
        { title:'References',         icon:Users,  completed: true },
        { title:'Face Verification',  icon:Camera, completed: !!livePhotoData && faceMatchPassed },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white py-8 px-4">
            <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-orange-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10"/>
                    <div className="relative">
                        <Link to="/register" className="inline-flex items-center text-white/90 hover:text-white mb-4">
                            <ArrowLeft className="h-5 w-5 mr-2"/>Back
                        </Link>
                        <div className="flex items-center justify-center mb-4">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mr-4 backdrop-blur-sm">
                                <User className="h-8 w-8 text-white"/>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold mb-2">Create Your Karigar Profile</h1>
                                <p className="text-orange-100 text-lg">Join India's most trusted platform for skilled professionals</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b border-orange-200">
                    <div className="flex items-center justify-start sm:justify-center gap-3 overflow-x-auto pb-2">
                        {sections.map((s, i) => {
                            const isActive = activeSection === i;
                            const isDone = s.completed && !isActive;

                            return (
                                <React.Fragment key={s.title}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSection(i)}
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
                                            {s.title}
                                        </span>
                                    </button>

                                    {i < sections.length - 1 && (
                                        <div className={`h-0.5 w-8 sm:w-12 ${activeSection > i ? 'bg-green-400' : 'bg-orange-200'}`} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* ── Section 0: Personal Details (UNCHANGED) ── */}
                        {activeSection === 0 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><User className="h-8 w-8 mr-3"/>Personal & Login Details</h2>
                                    <p className="text-gray-600 mt-2">Tell us about yourself and create your login credentials</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                                        <input name="name" value={formData.name} placeholder="Name as per Aadhar" onChange={handleChange} required className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-orange-50/50"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth *</label>
                                        <div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 h-5 w-5"/>
                                        <input name="dob" type="date" value={formData.dob} onChange={handleChange} required className="w-full pl-12 pr-4 py-4 border-2 border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 bg-orange-50/50"/></div>
                                        {computedAge !== null && (
                                            <p className={`mt-2 text-xs font-semibold ${computedAge >= 18 ? 'text-green-700' : 'text-red-600'}`}>
                                                Age: {computedAge} {computedAge >= 18 ? '(Eligible)' : '(Must be 18+)'}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Type</label>
                                        <div className="relative"><Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 h-5 w-5"/>
                                        <select name="phoneType" value={formData.phoneType} onChange={handleChange} className="w-full pl-12 pr-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"><option>Smartphone</option><option>Feature Phone</option></select></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Gender *</label>
                                        <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"><option>Male</option><option>Female</option><option>Other</option></select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Travel Method *</label>
                                        <select name="travelMethod" value={formData.travelMethod} onChange={handleChange} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50">
                                            {travelMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Mobile Number *</label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div className="relative flex-1">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-gray-600 font-semibold">+91</span></div>
                                                <input name="mobile" value={formData.mobile} placeholder="10-digit mobile" onChange={handleChange} required disabled={mobileVerified} className="w-full pl-14 pr-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50 disabled:bg-gray-100"/>
                                            </div>
                                            <button type="button" onClick={handleSendOtp} disabled={(otpSent && otpTimer > 0) || mobileVerified} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl disabled:from-gray-400 disabled:to-gray-500 min-w-32">
                                                {otpTimer > 0 ? <div className="flex items-center justify-center"><Clock className="h-4 w-4 mr-2"/>{formatTime(otpTimer)}</div> : otpSent ? 'Resend OTP' : 'Send OTP'}
                                            </button>
                                        </div>
                                        {otpSent && !mobileVerified && (
                                            <div className="mt-4 flex gap-4">
                                                <input placeholder="Enter 6-digit OTP" value={otp} onChange={e => setOtp(e.target.value)} className="flex-1 px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50" maxLength={6}/>
                                                <button type="button" onClick={handleVerifyOtp} className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl">Verify OTP</button>
                                            </div>
                                        )}
                                        {mobileVerified && <div className="mt-4 flex items-center justify-center text-green-600 font-semibold bg-green-50 p-4 rounded-xl border-2 border-green-200"><CheckCircle className="h-6 w-6 mr-3"/>Mobile Number Verified!</div>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                                        <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 h-5 w-5"/>
                                        <input type="email" name="email" value={formData.email} placeholder="For notifications" onChange={handleChange} className="w-full pl-12 pr-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"/></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">ID Proof Type *</label>
                                        <select name="idDocumentType" value={formData.idDocumentType} onChange={handleChange} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50">
                                            {documentTypes.map(d => <option key={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">{idNumberMeta.label}</label>
                                        <input
                                            name="idNumber"
                                            value={formData.idNumber}
                                            placeholder={idNumberMeta.placeholder}
                                            onChange={handleChange}
                                            required
                                            maxLength={idNumberMeta.maxLength}
                                            inputMode={idNumberMeta.inputMode}
                                            className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Create Password *</label>
                                        <div className="relative"><Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 h-5 w-5"/>
                                        <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} placeholder="Strong password" onChange={handleChange} required className="w-full pl-12 pr-12 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"/>
                                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
                                        <div className="mt-2">
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: strength.width }} />
                                            </div>
                                            <p className={`text-xs mt-1 ${strength.text}`}>Strength: {strength.label}</p>
                                            <p className="text-xs text-gray-500">{PASSWORD_POLICY_TEXT}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password *</label>
                                        <div className="relative"><Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 h-5 w-5"/>
                                        <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} placeholder="Confirm password" onChange={handleChange} required className="w-full pl-12 pr-12 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"/>
                                        <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div>
                                        {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                            <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end pt-6">
                                    <button type="button" onClick={() => setActiveSection(1)} disabled={!formData.name || !formData.dob || !formData.mobile || !mobileVerified} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl disabled:from-gray-400 disabled:to-gray-500 flex items-center">
                                        Next: Skills & Experience <Award className="h-5 w-5 ml-2"/>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Section 1: Skills (UNCHANGED) ── */}
                        {activeSection === 1 && (
                            <div className="space-y-8">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Award className="h-8 w-8 mr-3"/>Skills & Experience</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div><label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience</label>
                                    <input type="number" name="experience" value={formData.experience} placeholder="e.g., 5" onChange={handleChange} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-orange-50/50"/></div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Select Skills (max {MAX_WORKER_SKILLS}) and one Primary Skill *</label>
                                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6 max-h-96 overflow-y-auto">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {skillList.map(skill => (
                                                <div key={skill} className="bg-white p-4 rounded-xl border-2 border-orange-100 hover:border-orange-300 shadow-sm">
                                                    <div className="flex items-center mb-3">
                                                        <input type="checkbox" id={skill} name={skill} onChange={handleSkillCheckbox} checked={!!skills[skill]} className="h-5 w-5 text-orange-600"/>
                                                        <label htmlFor={skill} className="ml-3 text-sm font-medium text-gray-700">{skill}</label>
                                                    </div>
                                                    {skills[skill] && (
                                                        <label className="flex items-center gap-2 text-xs font-semibold text-orange-700">
                                                            <input
                                                                type="radio"
                                                                name="primarySkill"
                                                                checked={!!skills[skill]?.isPrimary}
                                                                onChange={() => handlePrimarySkill(skill)}
                                                                className="h-4 w-4 text-orange-600"
                                                            />
                                                            Mark as Primary Skill
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {skills.Other && (
                                        <div className="mt-4 bg-white p-4 rounded-xl border-2 border-orange-200">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Specify up to 2 Other Skills</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <input type="text" name="otherSkill" value={formData.otherSkill} onChange={handleChange} placeholder="Other skill 1" className="w-full px-4 py-3 border border-orange-200 rounded-lg"/>
                                                <input type="text" name="otherSkillSecondary" value={formData.otherSkillSecondary} onChange={handleChange} placeholder="Other skill 2 (optional)" className="w-full px-4 py-3 border border-orange-200 rounded-lg"/>
                                            </div>
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-600 mt-3">Selected: <span className="font-semibold text-orange-600">{Object.keys(skills).length}</span> / {MAX_WORKER_SKILLS}</p>
                                </div>
                                <div className="flex justify-between pt-6">
                                    <button type="button" onClick={() => setActiveSection(0)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center"><ArrowLeft className="h-5 w-5 mr-2"/>Back</button>
                                    <button type="button" onClick={() => setActiveSection(2)} disabled={Object.keys(skills).length === 0} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl disabled:from-gray-400 disabled:to-gray-500 flex items-center">Next: Address & Documents <MapPin className="h-5 w-5 ml-2"/></button>
                                </div>
                            </div>
                        )}

                        {/* ── Section 2: Address & Documents (UNCHANGED) ── */}
                        {activeSection === 2 && (
                            <div className="space-y-8">
                                <div className="text-center"><h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><MapPin className="h-8 w-8 mr-3"/>Address & Documents</h2></div>
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-orange-200 p-4 rounded-2xl shadow-sm">
                                        <label className="block text-sm font-semibold text-orange-800 mb-2">Select Location on Map</label>
                                        <LocationMapPicker
                                            onLocationSelected={handleMapLocationSelected}
                                            initialLat={formData.latitude}
                                            initialLng={formData.longitude}
                                        />
                                    </div>

                                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border-2 border-orange-200">
                                        <h3 className="text-xl font-semibold text-orange-800 mb-4 flex items-center"><MapPin className="h-5 w-5 mr-2"/>Address</h3>
                                        {locationError && <p className="text-sm text-red-600 mb-3">{locationError}</p>}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Address *</label>
                                                <input name="fullAddress" value={formData.fullAddress} placeholder="House/Street/Area" onChange={handleChange} required className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">District *</label>
                                                <input name="city" value={formData.city} placeholder="Your district" onChange={handleChange} required className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Village *</label>
                                                <input name="village" value={formData.village} placeholder="Village / Area" onChange={handleChange} required className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Pincode *</label>
                                                <input name="pincode" value={formData.pincode} placeholder="Area pincode" onChange={handleChange} required maxLength={6} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Locality *</label>
                                                <input name="locality" value={formData.locality} placeholder="Area / Locality" onChange={handleChange} required className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Latitude *</label>
                                                <input name="latitude" value={formData.latitude} placeholder="e.g. 28.6139" onChange={handleChange} required readOnly className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"/>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Longitude *</label>
                                                <input name="longitude" value={formData.longitude} placeholder="e.g. 77.2090" onChange={handleChange} required readOnly className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Profile Photo *</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center bg-orange-50/50">
                                            <Camera className="h-8 w-8 text-orange-500 mx-auto mb-2"/>
                                            <input type="file" name="photo" onChange={handleFileChange} accept="image/*" className="hidden" id="photo" required/>
                                            <label htmlFor="photo" className="cursor-pointer text-orange-600 font-semibold">Upload Profile Photo</label>
                                            {files.photo && <p className="text-sm text-green-600 mt-2">✓ {files.photo.name}</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">ID Proof *</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center bg-orange-50/50">
                                            <Upload className="h-8 w-8 text-orange-500 mx-auto mb-2"/>
                                            <input type="file" name="idProof" onChange={handleFileChange} accept="image/*,.pdf" className="hidden" id="idProof" required/>
                                            <label htmlFor="idProof" className="cursor-pointer text-orange-600 font-semibold">Upload {formData.idDocumentType}</label>
                                            {files.idProof && <p className="text-sm text-green-600 mt-2">✓ {files.idProof.name}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">E-Shram Number</label>
                                        <input
                                            name="eShramNumber"
                                            value={formData.eShramNumber}
                                            onChange={handleChange}
                                            placeholder="Enter E-Shram number"
                                            className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"
                                        />
                                        <p className="text-xs text-gray-600 mt-2">
                                            If you do not have it, register on{' '}
                                            <a href="https://eshram.gov.in/" target="_blank" rel="noreferrer" className="text-orange-600 font-semibold underline">
                                                e-Shram portal
                                            </a>
                                            .
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">E-Shram Card (optional)</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center bg-orange-50/50">
                                            <Upload className="h-8 w-8 text-orange-500 mx-auto mb-2"/>
                                            <input type="file" name="eShramCard" onChange={handleFileChange} accept="image/*,.pdf" className="hidden" id="eShramCard"/>
                                            <label htmlFor="eShramCard" className="cursor-pointer text-orange-600 font-semibold">Upload E-Shram Card</label>
                                            {files.eShramCard && <p className="text-sm text-green-600 mt-2">✓ {files.eShramCard.name}</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Contact Name</label>
                                        <input
                                            name="emergencyContactName"
                                            value={formData.emergencyContactName}
                                            onChange={handleChange}
                                            placeholder="Emergency person name"
                                            className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Emergency Contact Mobile</label>
                                        <input
                                            name="emergencyContactMobile"
                                            value={formData.emergencyContactMobile}
                                            onChange={handleChange}
                                            placeholder="10-digit emergency mobile"
                                            maxLength={10}
                                            className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Skill Certificates (optional, max 3)</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center bg-orange-50/50">
                                            <Award className="h-8 w-8 text-orange-500 mx-auto mb-2"/>
                                            <input type="file" name="skillCertificates" onChange={handleFileChange} accept="image/*,.pdf" multiple className="hidden" id="skillCertificates"/>
                                            <label htmlFor="skillCertificates" className="cursor-pointer text-orange-600 font-semibold">Upload Skill Certificates</label>
                                            {files.skillCertificates?.length > 0 && <p className="text-sm text-green-600 mt-2">✓ {files.skillCertificates.length} file(s) selected</p>}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Portfolio Photos (optional, max 4)</label>
                                        <div className="border-2 border-dashed border-orange-300 rounded-xl p-6 text-center bg-orange-50/50">
                                            <ImageIcon className="h-8 w-8 text-orange-500 mx-auto mb-2"/>
                                            <input type="file" name="portfolioPhotos" onChange={handleFileChange} accept="image/*" multiple className="hidden" id="portfolioPhotos"/>
                                            <label htmlFor="portfolioPhotos" className="cursor-pointer text-orange-600 font-semibold">Upload Portfolio Photos</label>
                                            {files.portfolioPhotos?.length > 0 && <p className="text-sm text-green-600 mt-2">✓ {files.portfolioPhotos.length} photo(s) selected</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between pt-6">
                                    <button type="button" onClick={() => setActiveSection(1)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center"><ArrowLeft className="h-5 w-5 mr-2"/>Back</button>
                                    <button type="button" onClick={() => setActiveSection(3)} disabled={!formData.fullAddress || !formData.city || !formData.village || !formData.pincode || !formData.locality || !formData.latitude || !formData.longitude || !files.photo || !files.idProof} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl disabled:from-gray-400 disabled:to-gray-500 flex items-center">Next: References <Users className="h-5 w-5 ml-2"/></button>
                                </div>
                            </div>
                        )}

                        {/* ── Section 3: References (UNCHANGED) ── */}
                        {activeSection === 3 && (
                            <div className="space-y-8">
                                <div className="text-center"><h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Users className="h-8 w-8 mr-3"/>References (Optional)</h2></div>
                                <div className="space-y-4">
                                    {references.map((ref, i) => (
                                        <div key={i} className="bg-gradient-to-br from-orange-50 to-amber-50 p-6 rounded-2xl border-2 border-orange-200">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Reference Name {i+1}</label>
                                                <input name="name" placeholder="Client/Employer Name" value={ref.name} onChange={e => handleReferenceChange(i, e)} className="w-full px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/></div>
                                                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Contact</label>
                                                <div className="flex gap-3">
                                                    <input name="contact" placeholder="Phone or Email" value={ref.contact} onChange={e => handleReferenceChange(i, e)} className="flex-1 px-4 py-4 border-2 border-orange-200 rounded-xl bg-white"/>
                                                    <button type="button" onClick={() => removeReference(i)} disabled={references.length === 1} className="px-6 py-4 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 disabled:bg-gray-100 disabled:text-gray-400">Remove</button>
                                                </div></div>
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addReference} className="w-full p-4 border-2 border-dashed border-orange-300 rounded-xl text-orange-600 hover:border-orange-400 font-semibold flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                                        Add Reference
                                    </button>
                                </div>
                                <div className="flex justify-between pt-6">
                                    <button type="button" onClick={() => setActiveSection(2)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center"><ArrowLeft className="h-5 w-5 mr-2"/>Back</button>
                                    <button type="button" onClick={() => setActiveSection(4)} className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl flex items-center">
                                        Next: Face Verification <Camera className="h-5 w-5 ml-2"/>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Section 4: Face Verification ← NEW ── */}
                        {activeSection === 4 && (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <h2 className="text-3xl font-bold text-orange-800 flex items-center justify-center"><Camera className="h-8 w-8 mr-3"/>Identity Verification</h2>
                                    <p className="text-gray-600 mt-2">We compare your live face with your uploaded ID card to confirm your identity</p>
                                </div>

                                {/* Explainer */}
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                                    <p className="font-bold text-blue-800 mb-3">📋 How it works</p>
                                    <div className="space-y-2">
                                        {[
                                            'Your ID card face is extracted and securely compared with your live photo',
                                            'You\'ll be asked to blink and turn your head to prove you are physically present',
                                            'The face match result is reviewed by our team along with your profile',
                                            'Your face data is stored securely and never shared with third parties',
                                        ].map((s, i) => (
                                            <div key={i} className="flex items-start gap-2">
                                                <span className="text-blue-500 font-bold flex-shrink-0 mt-0.5">{i+1}.</span>
                                                <p className="text-sm text-blue-700">{s}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Status */}
                                {livePhotoData ? (
                                    <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
                                        <div className="text-5xl mb-3">✅</div>
                                        <p className="text-xl font-bold text-green-800">Face Verification Complete!</p>
                                        <p className="text-green-600 mt-1 text-sm">Liveness detected and photo captured</p>
                                        <div className="mt-4">
                                            <img src={livePhotoData} alt="Captured face" className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-green-400 shadow-lg"/>
                                        </div>

                                        <div className="mt-4 bg-white border border-green-200 rounded-xl p-3 text-left max-w-md mx-auto">
                                            {checkingSimilarity ? (
                                                <p className="text-sm text-orange-700 font-medium">Verifying face match...</p>
                                            ) : (
                                                <>
                                                    <p className={`text-sm mt-1 font-semibold ${faceMatchPassed ? 'text-green-700' : 'text-red-700'}`}>
                                                        {faceMessage || (faceMatchPassed ? 'Congratulations, face match.' : 'Face not match with ID.')}
                                                    </p>
                                                </>
                                            )}
                                        </div>

                                        <button type="button" onClick={() => {
                                            setLivePhotoData(null);
                                            setFaceMatchPassed(false);
                                            setFaceMessage('');
                                        }} className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline">Redo verification</button>
                                    </div>
                                ) : (
                                    <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center">
                                        <Camera className="h-16 w-16 text-orange-400 mx-auto mb-4"/>
                                        <p className="font-bold text-gray-800 text-lg mb-2">Start Face Verification</p>
                                        <p className="text-sm text-gray-500 mb-5">Make sure you are in a well-lit area with your face clearly visible</p>
                                        <button type="button" onClick={() => setShowFaceVerification(true)}
                                            className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-2xl shadow-lg hover:from-orange-600 hover:to-amber-600 transition-all text-base">
                                            📷 Start Camera Verification
                                        </button>
                                    </div>
                                )}

                                <div className="bg-white border border-orange-200 rounded-2xl p-5">
                                    <p className="font-bold text-orange-800 mb-3">Registration Summary</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                        <p><span className="font-semibold">Name:</span> {formData.name || 'N/A'}</p>
                                        <p><span className="font-semibold">Mobile:</span> {formData.mobile || 'N/A'}</p>
                                        <p><span className="font-semibold">Age:</span> {computedAge ?? 'N/A'}</p>
                                        <p><span className="font-semibold">{formData.idDocumentType} Number:</span> {formData.idNumber || 'N/A'}</p>
                                        <p><span className="font-semibold">Travel:</span> {travelMethods.find((m) => m.value === formData.travelMethod)?.label || 'Other'}</p>
                                        <p><span className="font-semibold">E-Shram:</span> {formData.eShramNumber || 'Not provided'}</p>
                                        <p><span className="font-semibold">District:</span> {formData.city || 'N/A'}</p>
                                        <p><span className="font-semibold">Locality:</span> {formData.locality || 'N/A'}</p>
                                        <p><span className="font-semibold">ID Proof:</span> {files.idProof?.name || 'Not selected'}</p>
                                        <p><span className="font-semibold">E-Shram Card:</span> {files.eShramCard?.name || 'Not provided'}</p>
                                        <p><span className="font-semibold">Skill Certificates:</span> {files.skillCertificates?.length || 0}</p>
                                        <p><span className="font-semibold">Portfolio Photos:</span> {files.portfolioPhotos?.length || 0}</p>
                                    </div>
                                </div>

                                {/* Terms */}
                                <div className="pt-2 border-t border-orange-200">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"/>
                                        <span className="text-sm text-gray-700">I agree to the <button type="button" onClick={() => openLegalPreview('Terms and Conditions', '/terms-and-conditions')} className="text-orange-600 underline font-bold">Terms and Conditions</button> and <button type="button" onClick={() => openLegalPreview('Privacy Policy', '/privacy-policy')} className="text-orange-600 underline font-bold">Privacy Policy</button></span>
                                    </label>
                                    <label className="flex items-start gap-3 cursor-pointer mt-3">
                                        <input type="checkbox" checked={ageConsent} onChange={e => setAgeConsent(e.target.checked)} className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"/>
                                        <span className="text-sm text-gray-700">I confirm I am above 18 years old and provide consent for registration verification.</span>
                                    </label>
                                </div>

                                <div className="flex justify-between pt-4">
                                    <button type="button" onClick={() => setActiveSection(3)} className="px-8 py-4 bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center"><ArrowLeft className="h-5 w-5 mr-2"/>Back</button>
                                    <button type="submit" disabled={!mobileVerified || !agreedToTerms || !ageConsent || !livePhotoData || !faceMatchPassed || checkingSimilarity}
                                        className="px-12 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl disabled:from-gray-400 disabled:to-gray-500 shadow-xl text-lg flex items-center">
                                        <CheckCircle className="h-6 w-6 mr-3"/>Submit for Verification
                                    </button>
                                </div>
                            </div>
                        )}

                    </form>
                    <div className="mt-12 text-center border-t pt-8">
                        <p className="text-gray-600">Already have an account? <Link to="/login" className="text-orange-600 font-bold hover:text-orange-800 underline">Login here</Link></p>
                    </div>
                </div>
            </div>

            {legalPreview.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4" onClick={closeLegalPreview}>
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

            {showTermsGate && (
                <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-orange-200 shadow-2xl p-6">
                        <h3 className="text-xl font-black text-orange-800">Review Terms Before Registration</h3>
                        <p className="text-sm text-gray-600 mt-2">Please preview the legal policies once. After you accept, this screen will not be shown again.</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => openLegalPreview('Terms and Conditions', '/terms-and-conditions')} className="px-4 py-2 rounded-xl bg-orange-100 text-orange-700 font-bold hover:bg-orange-200">View Terms & Conditions</button>
                            <button type="button" onClick={() => openLegalPreview('Privacy Policy', '/privacy-policy')} className="px-4 py-2 rounded-xl bg-orange-100 text-orange-700 font-bold hover:bg-orange-200">View Privacy Policy</button>
                        </div>
                        <label className="mt-5 flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" checked={termsGateAccepted} onChange={(e) => setTermsGateAccepted(e.target.checked)} className="h-5 w-5 mt-0.5 rounded border-orange-300 text-orange-600"/>
                            <span className="text-sm text-gray-700">I have reviewed and accept the Terms and Privacy Policy for continuing registration.</span>
                        </label>
                        <button type="button" onClick={acceptTermsGate} className="mt-5 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black hover:from-orange-600 hover:to-amber-600">Accept and Continue</button>
                    </div>
                </div>
            )}

            {/* Face Verification Modal */}
            {showFaceVerification && (
                <FaceVerification
                    title="Worker Identity Verification"
                    subtitle="Complete all challenges to verify your identity"
                    onComplete={handleFaceComplete}
                    onCancel={() => setShowFaceVerification(false)}
                />
            )}
        </div>
    );
};

export default WorkerRegister;
