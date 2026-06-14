// src/pages/worker/ViewProfile.jsx
// PREMIUM VERSION - Mobile optimized with modern gradients and animations

import { getImageUrl } from '../../constants/config';
import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Edit, Save, X, Mail, Phone, MapPin, Calendar, 
    Award, Briefcase, BookOpen, Shield, Camera,
    Star, CheckCircle, Clock, Award as AwardIcon, Plus, Trash2,
    ChevronRight, ChevronDown, Globe, Heart, Users, TrendingUp,
    Upload, FileText, Link, ExternalLink, Smartphone, Home, Wallet, Eye,
    Verified, Crown, Diamond, Sparkles, Trophy, Zap, Gift,
    Target, Rocket, Settings, Bell, MessageCircle, ThumbsUp
} from 'lucide-react';
import WorkerProfessionalPortfolio from '../../components/WorkerProfessionalPortfolio';

const travelMethods = [
    { value: 'cycle', label: '🚲 Cycle' },
    { value: 'bike', label: '🏍️ Bike' },
    { value: 'bus', label: '🚌 Bus' },
    { value: 'other', label: '🚶 Other' },
];

const ViewProfile = () => {
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [skillsData, setSkillsData] = useState([]);
    const [referencesData, setReferencesData] = useState([]);
    const [files, setFiles] = useState({
        photo: null,
        idProof: null,
        eShramCard: null,
        skillCertificates: [],
        portfolioPhotos: [],
    });
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeSection, setActiveSection] = useState('personal');
    const [, setShowMobileMenu] = useState(false);
    const [locationError, setLocationError] = useState('');
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [viewerBlobUrl, setViewerBlobUrl] = useState('');
    const [viewerKind, setViewerKind] = useState('');
    const [viewerLoading, setViewerLoading] = useState(false);
    const [viewerError, setViewerError] = useState('');
    const [deletingSkillCertUrl, setDeletingSkillCertUrl] = useState('');
    const [deletingPortfolioUrl, setDeletingPortfolioUrl] = useState('');
    const [showPortfolioModal, setShowPortfolioModal] = useState(false);

    // ... (all helper functions remain the same - getAgeFromDob, getDocumentEntries, getPrintableValue, etc.)
    // Keeping all existing helper functions to preserve functionality

    const getAgeFromDob = (dob) => {
        if (!dob) return '';
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return '';
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
        return age >= 0 ? `${age} years` : '';
    };

    const getDocumentEntries = (data) => {
        if (!data) return [];
        const docs = [];

        if (data?.idProof?.filePath) {
            docs.push({
                label: 'ID Card Proof',
                url: data.idProof.filePath,
                category: 'idProof',
            });
        }

        if (data?.eShramCardPath) {
            docs.push({ label: 'e-Shram Card', url: data.eShramCardPath, category: 'eShram' });
        }

        (data?.skillCertificates || []).forEach((url, index) => {
            docs.push({ label: `Skill Certificate ${index + 1}`, url, category: 'skillCertificate' });
        });

        return docs.filter((d) => d.url);
    };

    const getPrintableValue = (value, fallback = 'Not provided') => {
        if (value === null || value === undefined || value === '') return fallback;
        if (Array.isArray(value)) return value.length ? value.join(', ') : fallback;
        return String(value);
    };

    const currencyLabel = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return 'Not specified';
        return `₹${n.toLocaleString('en-IN')}`;
    };

    const maskBankAccount = (value = '') => {
        const digits = String(value || '').replace(/\D/g, '');
        if (!digits) return 'Not provided';
        if (digits.length <= 4) return digits;
        return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
    };

    const maskUpiId = (value = '') => {
        const upi = String(value || '').trim();
        if (!upi) return 'Not provided';
        const [handle, provider] = upi.split('@');
        if (!provider) return upi;
        if (!handle || handle.length <= 2) return `**@${provider}`;
        return `${handle.slice(0, 2)}${'*'.repeat(Math.max(0, handle.length - 2))}@${provider}`;
    };

    const isImageDocument = (url = '') => /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i.test(url);
    const isPdfDocument = (url = '') => /\.pdf(\?|$)/i.test(url);
    const getDocumentKind = (url = '') => {
        if (isImageDocument(url)) return 'image';
        if (isPdfDocument(url)) return 'pdf';
        return 'other';
    };
    const getDocumentKindFromMime = (mime = '', fallbackUrl = '') => {
        const lowered = String(mime).toLowerCase();
        if (lowered.startsWith('image/')) return 'image';
        if (lowered.includes('pdf')) return 'pdf';
        return getDocumentKind(fallbackUrl);
    };
    const getPdfPreviewImageUrl = (url = '') => {
        const source = String(url || '');
        if (!source || !source.includes('res.cloudinary.com')) return '';
        if (!/\.pdf(\?|$)/i.test(source)) return '';
        const [base, query] = source.split('?');
        const transformed = base.replace('/upload/', '/upload/pg_1,f_jpg,q_auto/').replace(/\.pdf$/i, '.jpg');
        return query ? `${transformed}?${query}` : transformed;
    };
    const detectKindFromBlobSignature = async (blob, fallbackUrl = '') => {
        try {
            const head = await blob.slice(0, 16).arrayBuffer();
            const bytes = new Uint8Array(head);
            if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
            if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
            if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image';
            if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image';
        } catch (error) {
            // ignore error and fallback
        }
        return getDocumentKind(fallbackUrl);
    };

    const openDocumentInViewer = async (doc) => {
        if (!doc?.url) return;
        const resolvedUrl = getImageUrl(doc.url);
        const isLegacyUploadPath = String(doc.url || '').includes('/uploads/');

        setSelectedDocument({
            label: doc.label || 'Document',
            url: resolvedUrl,
        });

        if (viewerBlobUrl) {
            URL.revokeObjectURL(viewerBlobUrl);
            setViewerBlobUrl('');
        }

        setViewerLoading(true);
        setViewerError('');
        setViewerKind('');

        try {
            const response = await fetch(resolvedUrl);
            if (!response.ok) throw new Error('Unable to load document preview');

            const blob = await response.blob();
            const mime = blob?.type || response.headers.get('content-type') || '';
            let detectedKind = getDocumentKindFromMime(mime, doc.url);
            if (detectedKind === 'other') {
                detectedKind = await detectKindFromBlobSignature(blob, doc.url);
            }

            let previewBlob = blob;
            if (detectedKind === 'pdf' && !String(blob.type || '').toLowerCase().includes('pdf')) {
                previewBlob = new Blob([blob], { type: 'application/pdf' });
            }
            if (detectedKind === 'image' && !String(blob.type || '').toLowerCase().startsWith('image/')) {
                previewBlob = new Blob([blob], { type: 'image/jpeg' });
            }

            const objectUrl = URL.createObjectURL(previewBlob);
            setViewerBlobUrl(objectUrl);
            setViewerKind(detectedKind);
        } catch {
            const fallbackKind = getDocumentKind(doc.url);
            if (fallbackKind === 'image' || fallbackKind === 'pdf') {
                setViewerKind(fallbackKind);
                setViewerError('');
            } else {
                setViewerError(isLegacyUploadPath ? 'This old file is no longer available on server storage. Please re-upload it in Update Profile to preview.' : 'Preview unavailable in panel for this file type. Upload PDF or image format to preview.');
                setViewerKind(getDocumentKind(doc.url));
            }
        } finally {
            setViewerLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (viewerBlobUrl) URL.revokeObjectURL(viewerBlobUrl);
        };
    }, [viewerBlobUrl]);

    const DocumentViewerCard = ({ compact = false }) => {
        if (!selectedDocument) {
            return (
                <div className={`bg-white border border-orange-200 rounded-xl ${compact ? 'p-4' : 'p-5'} text-center`}>
                    <FileText size={24} className="text-orange-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Select any document to preview it here.</p>
                </div>
            );
        }
        return (
            <div className={`bg-white border border-orange-200 rounded-xl overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
                <div className="flex items-center justify-between p-3 border-b border-orange-100 bg-orange-50">
                    <p className="text-sm font-semibold text-gray-800 truncate">{selectedDocument.label}</p>
                    <button type="button" onClick={() => setSelectedDocument(null)} className="text-xs px-2 py-1 rounded-lg bg-white border border-orange-200 text-orange-700 hover:bg-orange-100">Close</button>
                </div>
                <div className={`bg-gray-50 ${compact ? 'h-64 sm:h-72' : 'h-72 sm:h-96'}`}>
                    {viewerLoading && <div className="w-full h-full flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div></div>}
                    {!viewerLoading && viewerError && <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 text-center"><p className="text-sm text-gray-600">{viewerError}</p></div>}
                    {!viewerLoading && !viewerError && viewerKind === 'image' && (viewerBlobUrl || selectedDocument?.url) && (
                        <img src={viewerBlobUrl || selectedDocument.url} alt={selectedDocument.label} className="w-full h-full object-contain bg-white" />
                    )}
                    {!viewerLoading && !viewerError && viewerKind === 'pdf' && selectedDocument?.url && (
                        getPdfPreviewImageUrl(selectedDocument.url) ? (
                            <img src={getPdfPreviewImageUrl(selectedDocument.url)} alt={`${selectedDocument.label} preview`} className="w-full h-full object-contain bg-white" onError={() => setViewerError('Failed to render PDF preview image.')} />
                        ) : viewerBlobUrl ? (
                            <iframe title={selectedDocument.label} src={`${viewerBlobUrl}#toolbar=0&navpanes=0&scrollbar=1`} className="w-full h-full border-0 bg-white" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 text-center"><p className="text-sm text-gray-600">PDF preview image is not available for this file.</p></div>
                        )
                    )}
                    {!viewerLoading && !viewerError && !['image', 'pdf'].includes(viewerKind) && (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4 text-center"><p className="text-sm text-gray-600">Inline preview is available only for PDF and image files.</p></div>
                    )}
                </div>
            </div>
        );
    };

    const initializeFormData = (data) => {
        setFormData({
            name: data.name || '',
            mobile: data.mobile || '',
            idNumberMasked: data.idProof?.maskedNumber || '',
            dob: data.dob ? new Date(data.dob).toISOString().slice(0, 10) : '',
            gender: data.gender || 'Male',
            email: data.email || '',
            fullAddress: data.address?.fullAddress || '',
            city: data.address?.city || '',
            village: data.address?.village || '',
            pincode: data.address?.pincode || '',
            locality: data.address?.locality || '',
            latitude: data.address?.latitude ?? '',
            longitude: data.address?.longitude ?? '',
            phoneType: data.phoneType || 'Smartphone',
            experience: data.experience || '',
            eShramNumber: data.eShramNumber || '',
            idDocumentType: data.idProof?.idType || '',
            expectedMinPay: data.expectedMinPay || '',
            expectedMaxPay: data.expectedMaxPay || '',
            payoutPreference: data.payoutPreference || '',
            payoutUpiId: data.payoutUpiId || '',
            payoutBankAccountNumber: data.payoutBankAccountNumber || '',
            payoutBankIfsc: data.payoutBankIfsc || '',
            payoutAccountHolderName: data.payoutAccountHolderName || '',
            travelMethod: data.travelMethod || 'other',
            preferredJobCategoriesInput: Array.isArray(data.preferredJobCategories) ? data.preferredJobCategories.join(', ') : '',
            emergencyContactName: data.emergencyContact?.name || '',
            emergencyContactMobile: data.emergencyContact?.mobile || '',
            education: data.education || '',
        });
        const incomingSkills = Array.isArray(data.skills) ? data.skills : [];
        const normalizedSkills = incomingSkills
            .map((skill) => ({
                name: String(skill?.name || '').trim(),
                isPrimary: !!skill?.isPrimary,
            }))
            .filter((skill) => skill.name)
            .slice(0, 4);
        if (normalizedSkills.length > 0 && !normalizedSkills.some((skill) => skill.isPrimary)) {
            normalizedSkills[0].isPrimary = true;
        }
        setSkillsData(normalizedSkills);
        setReferencesData(data.references || []);
    };

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.getWorkerProfile();
            setProfile(data);
            initializeFormData(data);
            setSelectedDocument(null);
            setViewerError('');
            setViewerKind('');
            setViewerBlobUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return '';
            });
        } catch {
            toast.error("Could not load profile.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    
    const handleFileChange = (e) => {
        const { name, files: selectedFiles } = e.target;
        if (selectedFiles) {
            if (name === 'skillCertificates') {
                const currentCount = Array.isArray(profile?.skillCertificates) ? profile.skillCertificates.length : 0;
                const allowedCount = Math.max(0, 3 - currentCount);
                const picked = Array.from(selectedFiles);
                const limited = picked.slice(0, allowedCount);
                if (picked.length > allowedCount) toast.error(`Only ${allowedCount} more skill certificate(s) can be uploaded. Maximum is 3.`);
                setFiles(prev => ({ ...prev, skillCertificates: limited }));
            } else if (name === 'portfolioPhotos') {
                const currentCount = Array.isArray(profile?.portfolioPhotos) ? profile.portfolioPhotos.length : 0;
                const allowedCount = Math.max(0, 4 - currentCount);
                const picked = Array.from(selectedFiles);
                const limited = picked.slice(0, allowedCount);
                if (picked.length > allowedCount) toast.error(`Only ${allowedCount} more portfolio photo(s) can be uploaded. Maximum is 4.`);
                setFiles(prev => ({ ...prev, portfolioPhotos: limited }));
            } else {
                setFiles(prev => ({ ...prev, [name]: selectedFiles[0] }));
            }
        }
    };

    const deleteSkillCertificate = async (certUrl) => {
        if (!certUrl || deletingSkillCertUrl) return;
        setDeletingSkillCertUrl(certUrl);
        const toastId = toast.loading('Deleting certificate...');
        try {
            const data = new FormData();
            data.append('deletedSkillCertificates', JSON.stringify([certUrl]));
            await api.updateWorkerProfile(data);
            setProfile((prev) => {
                if (!prev) return prev;
                return { ...prev, skillCertificates: (prev.skillCertificates || []).filter((u) => u !== certUrl) };
            });
            if (selectedDocument?.url === getImageUrl(certUrl)) {
                setSelectedDocument(null);
                if (viewerBlobUrl) { URL.revokeObjectURL(viewerBlobUrl); setViewerBlobUrl(''); }
                setViewerKind(''); setViewerError('');
            }
            toast.success('Certificate deleted.', { id: toastId });
            fetchProfile();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete certificate.', { id: toastId });
        } finally {
            setDeletingSkillCertUrl('');
        }
    };

    const deletePortfolioPhoto = async (photoUrl) => {
        if (!photoUrl || deletingPortfolioUrl) return;
        setDeletingPortfolioUrl(photoUrl);
        const toastId = toast.loading('Deleting portfolio photo...');
        try {
            const data = new FormData();
            data.append('deletedPortfolioPhotos', JSON.stringify([photoUrl]));
            await api.updateWorkerProfile(data);
            setProfile((prev) => {
                if (!prev) return prev;
                return { ...prev, portfolioPhotos: (prev.portfolioPhotos || []).filter((u) => u !== photoUrl) };
            });
            if (selectedDocument?.url === getImageUrl(photoUrl)) {
                setSelectedDocument(null);
                if (viewerBlobUrl) { URL.revokeObjectURL(viewerBlobUrl); setViewerBlobUrl(''); }
                setViewerKind(''); setViewerError('');
            }
            toast.success('Portfolio photo deleted.', { id: toastId });
            fetchProfile();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to delete portfolio photo.', { id: toastId });
        } finally {
            setDeletingPortfolioUrl('');
        }
    };

    const captureLocation = async () => {
        setLocationError('');
        if (!navigator.geolocation) {
            const msg = 'Geolocation is not supported by your browser.';
            setLocationError(msg);
            toast.error(msg);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setFormData((prev) => ({ ...prev, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    const data = await response.json();
                    const addr = data?.address || {};
                    const houseNum = addr.house_number || '';
                    const roadName = addr.road || addr.street || '';
                    const fullAddress = [houseNum, roadName].filter(Boolean).join(', ');
                    const districtName = addr.county || addr.city || addr.town || addr.state_district || '';
                    const villageName = addr.village || addr.hamlet || addr.suburb || '';
                    const pincode = addr.postcode || '';
                    setFormData((prev) => ({ ...prev, fullAddress: fullAddress || prev.fullAddress, city: districtName || prev.city, village: villageName || prev.village, locality: villageName || prev.locality, pincode: pincode || prev.pincode }));
                    toast.success('Live location captured and address updated.');
                } catch {
                    toast.success('Live location captured. Fill address manually if needed.');
                }
            },
            (error) => {
                let msg = 'Unable to capture live location.';
                if (error.code === error.PERMISSION_DENIED) msg = 'Location permission denied. Please enable location access.';
                else if (error.code === error.POSITION_UNAVAILABLE) msg = 'Location information is unavailable.';
                else if (error.code === error.TIMEOUT) msg = 'Location request timed out. Please try again.';
                setLocationError(msg);
                toast.error(msg);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    };

    const handleSkillChange = (index, key, value) => {
        setSkillsData((prev) => {
            const next = [...prev];
            if (!next[index]) return prev;
            next[index] = { ...next[index], [key]: value };

            if (key === 'isPrimary' && value === true) {
                return next.map((item, idx) => ({ ...item, isPrimary: idx === index }));
            }

            return next;
        });
    };

    const addSkill = () => {
        if (skillsData.length >= 4) {
            toast.error('Maximum 4 skills are allowed.');
            return;
        }
        setSkillsData((prev) => ([...prev, { name: '', isPrimary: prev.length === 0 }]));
    };
    const removeSkill = (index) => {
        setSkillsData((prev) => {
            const removed = prev[index];
            const next = prev.filter((_, i) => i !== index);
            if (removed?.isPrimary && next.length > 0) {
                next[0] = { ...next[0], isPrimary: true };
            }
            return next;
        });
    };

    const handleReferenceChange = (index, key, value) => {
        const newReferences = [...referencesData];
        newReferences[index][key] = value;
        setReferencesData(newReferences);
    };

    const addReference = () => setReferencesData([...referencesData, { name: '', contact: '' }]);
    const removeReference = (index) => setReferencesData(referencesData.filter((_, i) => i !== index));

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUploading(true);

        const currentSkillCertCount = Array.isArray(profile?.skillCertificates) ? profile.skillCertificates.length : 0;
        const pendingSkillCertCount = Array.isArray(files.skillCertificates) ? files.skillCertificates.length : 0;
        if (currentSkillCertCount + pendingSkillCertCount > 3) {
            toast.error('Maximum 3 skill certificates are allowed. Delete existing certificates before adding new ones.');
            setUploading(false);
            return;
        }

        const currentPortfolioCount = Array.isArray(profile?.portfolioPhotos) ? profile.portfolioPhotos.length : 0;
        const pendingPortfolioCount = Array.isArray(files.portfolioPhotos) ? files.portfolioPhotos.length : 0;
        if (currentPortfolioCount + pendingPortfolioCount > 4) {
            toast.error('Maximum 4 portfolio photos are allowed. Delete existing photos before adding new ones.');
            setUploading(false);
            return;
        }
        
        const data = new FormData();
        Object.keys(formData).filter((key) => !['mobile', 'name', 'idNumberMasked', 'idDocumentType'].includes(key)).forEach(key => data.append(key, formData[key]));
        const preferredCategories = String(formData.preferredJobCategoriesInput || '').split(',').map((v) => v.trim()).filter(Boolean);
        data.set('preferredJobCategories', JSON.stringify(preferredCategories));
        const normalizedSkills = skillsData
            .map((skill) => ({
                name: String(skill?.name || '').trim(),
                isPrimary: !!skill?.isPrimary,
            }))
            .filter((skill) => skill.name);

        if (normalizedSkills.length === 0) {
            toast.error('Please add at least one skill.');
            setUploading(false);
            return;
        }
        if (normalizedSkills.length > 4) {
            toast.error('Maximum 4 skills are allowed.');
            setUploading(false);
            return;
        }
        if (!normalizedSkills.some((skill) => skill.isPrimary)) {
            normalizedSkills[0].isPrimary = true;
        }

        const primarySkillName = (normalizedSkills.find((skill) => skill.isPrimary) || normalizedSkills[0]).name;
        data.append('skills', JSON.stringify(normalizedSkills));
        data.append('primarySkill', primarySkillName);
        data.append('references', JSON.stringify(referencesData.filter(r => r.name.trim() !== '' && r.contact.trim() !== '')));

        if (files.photo) data.append('photo', files.photo);
        if (files.eShramCard) data.append('eShramCard', files.eShramCard);
        Array.from(files.skillCertificates || []).forEach(file => data.append('skillCertificates', file));
        Array.from(files.portfolioPhotos || []).forEach(file => data.append('portfolioPhotos', file));

        const toastId = toast.loading('Updating profile...');
        try {
            await api.updateWorkerProfile(data);
            toast.success('Profile updated successfully!', { id: toastId });
            setIsEditing(false);
            setFiles({ photo: null, idProof: null, eShramCard: null, skillCertificates: [], portfolioPhotos: [] });
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile.', { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    // Premium UI Components
    const DetailItem = ({ label, value, icon: Icon, color = "text-orange-600", gradient = "from-orange-50 to-amber-50" }) => (
        <motion.div whileHover={{ scale: 1.02, y: -2 }} className={`bg-gradient-to-r ${gradient} p-3 rounded-xl border border-orange-100 hover:shadow-md transition-all`}>
            <div className="flex items-center gap-2">
                <div className={`p-1.5 bg-orange-100 rounded-lg ${color}`}><Icon size={14} /></div>
                <div className="flex-1 min-w-0"><p className="text-[9px] font-bold text-orange-600 uppercase tracking-wide">{label}</p><p className="text-gray-700 font-medium text-sm mt-0.5 break-words">{value || 'Not provided'}</p></div>
            </div>
        </motion.div>
    );

    const StatCard = ({ title, value, subtitle, icon: Icon, gradient, delay = 0 }) => (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`bg-gradient-to-r ${gradient} p-4 rounded-xl text-white shadow-lg hover:shadow-xl transition-all`}>
            <div className="flex items-center justify-between"><div className="flex-1 min-w-0"><p className="text-xs opacity-90">{title}</p><p className="text-xl font-bold mt-1 truncate">{value}</p>{subtitle && <p className="text-[9px] opacity-80 mt-1">{subtitle}</p>}</div><div className="p-2 bg-white/20 rounded-lg"><Icon size={18} /></div></div>
        </motion.div>
    );

    const SectionButton = ({ id, label, icon: Icon, active }) => (
        <button onClick={() => { setActiveSection(id); setShowMobileMenu(false); }} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${active === id ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md' : 'text-gray-600 hover:bg-orange-100 hover:text-orange-600'}`}>
            <Icon size={14} /><span className="hidden sm:inline">{label}</span><span className="sm:hidden">{label.split(' ')[0]}</span>
        </button>
    );

    if (loading) return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center">
            <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent mx-auto"></div><p className="text-gray-500 mt-4 text-sm">Loading your profile...</p></div>
        </div>
    );
    
    if (!profile) return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center p-4">
            <div className="text-center p-6 bg-white rounded-xl shadow-md border border-orange-200 max-w-sm"><div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3"><User size={28} className="text-orange-500" /></div><h3 className="text-lg font-semibold text-gray-800 mb-1">Profile Not Found</h3><p className="text-gray-500 text-sm">Could not load profile data. Please try again.</p></div>
        </div>
    );

    const sections = [
                { id: 'personal', label: 'Personal', icon: User },
        { id: 'professional', label: 'Professional', icon: Briefcase },
        { id: 'payout', label: 'Payout', icon: Wallet },
        { id: 'skills', label: 'Skills', icon: Award },
        { id: 'references', label: 'References', icon: Users },
        { id: 'documents', label: 'Documents', icon: FileText },
    ];

    const ageLabel = getAgeFromDob(profile?.dob);
    const profileDocuments = getDocumentEntries(profile);

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="worker-page-profile"
                    className="mb-6"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <img 
                                        src={profile.photo ? getImageUrl(profile.photo) : `https://ui-avatars.com/api/?name=${profile.name}&background=fb923c&color=fff&size=80`} 
                                        alt={profile.name} 
                                        className="w-14 h-14 rounded-xl object-cover border-2 border-white/30 shadow-lg"
                                    />
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                        <CheckCircle size={10} className="text-white" />
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold">{profile.name}</h1>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className="bg-white/20 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold">{profile.karigarId}</span>
                                        <span className="bg-emerald-500/30 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"><Verified size={10} /> Verified</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setIsEditing(!isEditing); if (isEditing) initializeFormData(profile); }} 
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                                        isEditing ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white text-orange-600 hover:shadow-md'
                                    }`}
                                >
                                    {isEditing ? <X size={14} /> : <Edit size={14} />}
                                    {isEditing ? 'Cancel' : 'Edit Profile'}
                                </button>
                                {!isEditing && (
                                    <button onClick={() => setShowPortfolioModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl font-semibold text-sm hover:shadow-md transition-all">
                                        <Eye size={14} /> Portfolio
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {isEditing ? (
                    // EDITING VIEW - Premium Form
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Edit size={20} /> Edit Your Profile</h2>
                            <p className="text-orange-100 text-sm mt-1">Update your information to keep your profile current</p>
                        </div>
                        
                        <form onSubmit={handleUpdate} className="p-6 space-y-6">
                            {/* Contact & Address Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Phone size={16} /> Contact & Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label><input value={formData.name || ''} disabled className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-sm text-gray-600" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label><input value={formData.mobile || ''} disabled className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-sm text-gray-600" /></div>
                                    <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label><input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth</label><input type="date" name="dob" value={formData.dob || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Gender</label><select name="gender" value={formData.gender || 'Male'} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500"><option>Male</option><option>Female</option><option>Other</option></select></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Phone Type</label><select name="phoneType" value={formData.phoneType} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl"><option>Smartphone</option><option>Feature Phone</option></select></div>
                                    <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Full Address</label><input name="fullAddress" value={formData.fullAddress} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">District</label><input name="city" value={formData.city} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Pincode</label><input name="pincode" value={formData.pincode} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Locality</label><input name="locality" value={formData.locality} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div className="md:col-span-2"><button type="button" onClick={captureLocation} className="px-4 py-2 bg-orange-100 text-orange-700 rounded-xl font-semibold hover:bg-orange-200 transition-colors">📍 Capture Live Location</button>{locationError && <p className="text-xs text-red-500 mt-2">{locationError}</p>}</div>
                                </div>
                            </div>

                            {/* Professional Info Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Briefcase size={16} /> Professional Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Years of Experience</label><input type="number" name="experience" value={formData.experience} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Education</label><input name="education" value={formData.education} placeholder="e.g., 10th Pass, ITI Diploma, Graduate" onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">e-Shram Number</label><input name="eShramNumber" value={formData.eShramNumber} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Expected Min Pay (INR)</label><input type="number" name="expectedMinPay" value={formData.expectedMinPay} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Expected Max Pay (INR)</label><input type="number" name="expectedMaxPay" value={formData.expectedMaxPay} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Travel Method</label><select name="travelMethod" value={formData.travelMethod || 'other'} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl">{travelMethods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
                                    <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Job Categories (comma separated)</label><input name="preferredJobCategoriesInput" value={formData.preferredJobCategoriesInput} onChange={handleChange} placeholder="Plumber, Electrician" className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                </div>
                            </div>

                            {/* Payout Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Wallet size={16} /> Payout Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Payout Preference</label><select name="payoutPreference" value={formData.payoutPreference || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl"><option value="">Select</option><option value="upi">UPI</option><option value="bank">Bank Transfer</option></select></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Account Holder Name</label><input name="payoutAccountHolderName" value={formData.payoutAccountHolderName || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    {formData.payoutPreference === 'upi' && <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">UPI ID</label><input name="payoutUpiId" value={formData.payoutUpiId || ''} onChange={handleChange} placeholder="example@upi" className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>}
                                    {formData.payoutPreference === 'bank' && (<><div><label className="block text-xs font-semibold text-gray-700 mb-1">Bank Account Number</label><input name="payoutBankAccountNumber" value={formData.payoutBankAccountNumber || ''} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">IFSC Code</label><input name="payoutBankIfsc" value={formData.payoutBankIfsc || ''} onChange={(e) => setFormData({ ...formData, payoutBankIfsc: String(e.target.value || '').toUpperCase() })} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl uppercase" /></div></>)}
                                </div>
                            </div>

                            {/* Skills Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Award size={16} /> Skills (max 4) & Primary Skill</h3>
                                <div className="space-y-3">
                                    {skillsData.map((skill, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-xl border border-orange-100">
                                            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">Skill Name</label><input type="text" value={skill.name} onChange={(e) => handleSkillChange(index, 'name', e.target.value)} placeholder="e.g., Plumbing" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                                            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">Primary Skill</label><label className="flex items-center gap-2 mt-2 text-sm text-gray-700"><input type="radio" name="primarySkillEdit" checked={!!skill.isPrimary} onChange={() => handleSkillChange(index, 'isPrimary', true)} className="h-4 w-4 text-orange-600" /> Mark Primary</label></div>
                                            <button type="button" onClick={() => removeSkill(index)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 self-end sm:self-center"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addSkill} disabled={skillsData.length >= 4} className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-2.5 rounded-xl hover:bg-orange-50 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={14} /> Add New Skill</button>
                                </div>
                            </div>

                            {/* References Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Users size={16} /> References</h3>
                                <div className="space-y-3">
                                    {referencesData.map((ref, index) => (
                                        <div key={index} className="flex flex-col sm:flex-row gap-2 bg-white p-3 rounded-xl border border-orange-100">
                                            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">Reference Name</label><input type="text" value={ref.name} onChange={(e) => handleReferenceChange(index, 'name', e.target.value)} placeholder="Name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                                            <div className="flex-1"><label className="text-[10px] font-semibold text-gray-500">Contact</label><input type="text" value={ref.contact} onChange={(e) => handleReferenceChange(index, 'contact', e.target.value)} placeholder="Mobile or Email" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div>
                                            <button type="button" onClick={() => removeReference(index)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 self-end sm:self-center"><Trash2 size={14} /></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addReference} className="w-full border-2 border-dashed border-orange-400 text-orange-600 py-2.5 rounded-xl hover:bg-orange-50 flex items-center justify-center gap-2 text-sm font-semibold"><Plus size={14} /> Add Reference</button>
                                </div>
                            </div>

                            {/* Emergency Contact */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Shield size={16} /> Emergency Contact</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Contact Name</label><input name="emergencyContactName" value={formData.emergencyContactName} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Contact Mobile</label><input name="emergencyContactMobile" type="tel" value={formData.emergencyContactMobile} onChange={handleChange} className="w-full px-4 py-2.5 border border-orange-200 rounded-xl" /></div>
                                </div>
                            </div>

                            {/* Documents Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-200">
                                <h3 className="text-base font-semibold text-orange-800 mb-4 flex items-center gap-2"><Camera size={16} /> Documents & Photos</h3>
                                
                                <div className="mb-4"><h4 className="font-semibold text-gray-800 text-sm mb-2">Uploaded Documents</h4>
                                    {profileDocuments.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {profileDocuments.map((doc, idx) => (
                                                <div key={`edit-doc-${idx}`} className="flex items-center gap-2 p-2.5 rounded-lg border border-orange-200 bg-white">
                                                    <button type="button" onClick={() => openDocumentInViewer(doc)} className="flex-1 text-left"><span className="text-xs text-gray-700 truncate block">{doc.label}</span></button>
                                                    <span className="text-[10px] font-bold text-orange-700">View</span>
                                                    {doc.category === 'skillCertificate' && <button type="button" onClick={() => deleteSkillCertificate(doc.url)} disabled={deletingSkillCertUrl === doc.url} className="p-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"><Trash2 size={10} /></button>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No uploaded documents available yet.</p>}
                                    <DocumentViewerCard compact />
                                </div>

                                <div className="mb-4"><h4 className="font-semibold text-gray-800 text-sm mb-2">Portfolio Photos</h4>
                                    {profile?.portfolioPhotos?.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-2">
                                            {profile.portfolioPhotos.map((photo, idx) => (
                                                <div key={`edit-portfolio-${idx}`} className="relative rounded-lg overflow-hidden border border-orange-100">
                                                    <button type="button" onClick={() => openDocumentInViewer({ label: `Portfolio Photo ${idx + 1}`, url: photo })}><img src={getImageUrl(photo)} alt={`Portfolio ${idx + 1}`} className="w-full h-20 object-cover" /></button>
                                                    <button type="button" onClick={() => deletePortfolioPhoto(photo)} disabled={deletingPortfolioUrl === photo} className="absolute top-1 right-1 p-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">No portfolio photos uploaded yet.</p>}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="border-2 border-dashed border-orange-300 rounded-xl p-3 text-center hover:border-orange-400"><Camera size={20} className="text-orange-500 mx-auto mb-1" /><input type="file" name="photo" onChange={handleFileChange} className="hidden" id="photo-upload" accept="image/*" /><label htmlFor="photo-upload" className="cursor-pointer block"><div className="text-orange-600 font-semibold text-xs">Upload Photo</div></label>{files.photo && <p className="text-xs text-green-600 mt-1">✓ {files.photo.name}</p>}</div>
                                    <div className="border-2 border-dashed border-orange-300 rounded-xl p-3 text-center hover:border-orange-400"><FileText size={20} className="text-orange-500 mx-auto mb-1" /><input type="file" name="eShramCard" onChange={handleFileChange} className="hidden" id="eshram-upload" accept="image/*,.pdf" /><label htmlFor="eshram-upload" className="cursor-pointer block"><div className="text-orange-600 font-semibold text-xs">Upload e-Shram Card</div></label>{files.eShramCard && <p className="text-xs text-green-600 mt-1">✓ {files.eShramCard.name}</p>}</div>
                                    <div className="border-2 border-dashed border-orange-300 rounded-xl p-3 text-center hover:border-orange-400"><Upload size={20} className="text-orange-500 mx-auto mb-1" /><input type="file" name="skillCertificates" multiple onChange={handleFileChange} className="hidden" id="skill-cert-upload" accept="image/*,.pdf" /><label htmlFor="skill-cert-upload" className="cursor-pointer block"><div className="text-orange-600 font-semibold text-xs">Upload Skill Certificates</div></label><p className="text-xs text-gray-500">Max 3</p>{files.skillCertificates?.length > 0 && <p className="text-xs text-green-600">✓ {files.skillCertificates.length} file(s)</p>}</div>
                                    <div className="border-2 border-dashed border-orange-300 rounded-xl p-3 text-center hover:border-orange-400"><Camera size={20} className="text-orange-500 mx-auto mb-1" /><input type="file" name="portfolioPhotos" multiple onChange={handleFileChange} className="hidden" id="portfolio-upload" accept="image/*" /><label htmlFor="portfolio-upload" className="cursor-pointer block"><div className="text-orange-600 font-semibold text-xs">Upload Portfolio Photos</div></label><p className="text-xs text-gray-500">Max 4</p>{files.portfolioPhotos?.length > 0 && <p className="text-xs text-green-600">✓ {files.portfolioPhotos.length} photo(s)</p>}</div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button type="submit" disabled={uploading} className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                                    {uploading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <Save size={18} />}
                                    <span>{uploading ? 'Saving...' : 'Save Changes'}</span>
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    // READ-ONLY VIEW
                    <div className="space-y-6">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard title="Reputation" value={profile.points || "85"} subtitle="Excellent" icon={Star} gradient="from-orange-500 to-amber-500" delay={0} />
                            <StatCard title="Jobs Done" value={profile.completedJobs || "24"} subtitle="Completed" icon={CheckCircle} gradient="from-emerald-500 to-green-600" delay={0.1} />
                            <StatCard title="Response" value="2.4h" subtitle="Average" icon={Clock} gradient="from-blue-500 to-cyan-600" delay={0.2} />
                            <StatCard title="Success" value="92%" subtitle="Rate" icon={Award} gradient="from-purple-500 to-pink-600" delay={0.3} />
                        </div>

                        {/* Section Navigation */}
                        <div className="bg-white rounded-xl p-1 flex gap-1 overflow-x-auto shadow-sm border border-gray-100">
                            {sections.map(section => <SectionButton key={section.id} id={section.id} label={section.label} icon={section.icon} active={activeSection} />)}
                        </div>

                        {/* Personal Information */}
                        {activeSection === 'personal' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><User size={18} /> Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <DetailItem label="Mobile Number" value={profile.mobile} icon={Phone} />
                                    <DetailItem label="Email Address" value={profile.email} icon={Mail} />
                                    <DetailItem label="Date of Birth" value={profile.dob ? new Date(profile.dob).toLocaleDateString() : 'Not provided'} icon={Calendar} />
                                    <DetailItem label="Age" value={ageLabel || 'Not available'} icon={Calendar} />
                                    <DetailItem label="Gender" value={profile.gender || 'Not specified'} icon={User} />
                                    <DetailItem label="ID Proof Type" value={profile.idProof?.idType || 'Not provided'} icon={Shield} />
                                    <DetailItem label="District" value={profile.address?.city} icon={MapPin} />
                                    <DetailItem label="Pincode" value={profile.address?.pincode} icon={MapPin} />
                                    <DetailItem label="Full Address" value={profile.address?.fullAddress || 'Not provided'} icon={Home} />
                                    <DetailItem label="Phone Type" value={profile.phoneType} icon={Smartphone} />
                                </div>
                            </motion.div>
                        )}

                        {/* Professional Information */}
                        {activeSection === 'professional' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><Briefcase size={18} /> Professional Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <DetailItem label="Years Experience" value={`${profile.experience || 0} years`} icon={Clock} />
                                    <DetailItem label="Education" value={profile.education || 'Not specified'} icon={BookOpen} />
                                    <DetailItem label="e-Shram Number" value={profile.eShramNumber || 'Not provided'} icon={FileText} />
                                    <DetailItem label="Expected Min Pay" value={profile.expectedMinPay ? currencyLabel(profile.expectedMinPay) : 'Not specified'} icon={TrendingUp} />
                                    <DetailItem label="Expected Max Pay" value={profile.expectedMaxPay ? currencyLabel(profile.expectedMaxPay) : 'Not specified'} icon={TrendingUp} />
                                    <DetailItem label="Travel Method" value={profile.travelMethod ? String(profile.travelMethod).toUpperCase() : 'Not specified'} icon={MapPin} />
                                    <DetailItem label="Preferred Categories" value={Array.isArray(profile.preferredJobCategories) && profile.preferredJobCategories.length ? profile.preferredJobCategories.join(', ') : 'Not specified'} icon={Briefcase} />
                                </div>
                                <div className="mt-6 pt-4 border-t border-orange-100">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Shield size={14} className="text-orange-500" /> Emergency Contact</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><DetailItem label="Contact Name" value={profile.emergencyContact?.name} icon={User} /><DetailItem label="Contact Mobile" value={profile.emergencyContact?.mobile} icon={Phone} /></div>
                                </div>
                            </motion.div>
                        )}

                        {/* Payout Details */}
                        {activeSection === 'payout' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><Wallet size={18} /> Payout Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    <DetailItem label="Payout Preference" value={profile.payoutPreference ? String(profile.payoutPreference).toUpperCase() : 'Not specified'} icon={Wallet} />
                                    <DetailItem label="UPI ID" value={maskUpiId(profile.payoutUpiId)} icon={Wallet} />
                                    <DetailItem label="Bank Account" value={maskBankAccount(profile.payoutBankAccountNumber)} icon={Wallet} />
                                    <DetailItem label="IFSC" value={profile.payoutBankIfsc || 'Not provided'} icon={Wallet} />
                                    <DetailItem label="Account Holder" value={profile.payoutAccountHolderName || 'Not provided'} icon={User} />
                                </div>
                            </motion.div>
                        )}

                        {/* Skills Section */}
                        {activeSection === 'skills' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><Award size={18} /> Skills & Expertise</h3>
                                {profile.skills?.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {profile.skills.map((skill, idx) => (
                                            <motion.div key={skill.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} className="bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2 rounded-xl border border-orange-200 shadow-sm">
                                                <div className="flex items-center gap-2"><span className="font-semibold text-gray-800 text-sm">{skill.name}</span>{skill.isPrimary && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Primary</span>}</div>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : <p className="text-gray-500 text-sm text-center py-8">No skills added yet</p>}
                            </motion.div>
                        )}

                        {/* References Section */}
                        {activeSection === 'references' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><Users size={18} /> Professional References</h3>
                                {profile.references?.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {profile.references.map((ref, idx) => (
                                            <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} className="bg-gradient-to-r from-orange-50 to-amber-50 p-3 rounded-xl border border-orange-100">
                                                <p className="font-semibold text-gray-800 text-sm">{ref.name}</p><p className="text-xs text-gray-600 mt-1 break-words">{ref.contact}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                ) : <p className="text-gray-500 text-sm text-center py-8">No references provided</p>}
                            </motion.div>
                        )}

                        {/* Documents Section */}
                        {activeSection === 'documents' && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-orange-800 mb-5 flex items-center gap-2"><FileText size={18} /> Certificates & Documents</h3>
                                {profileDocuments.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {profileDocuments.map((doc, idx) => (
                                                <div key={`${doc.label}-${idx}`} className={`flex items-center gap-2 p-3 rounded-xl border ${selectedDocument?.url === getImageUrl(doc.url) ? 'border-orange-400 bg-orange-100' : 'border-orange-100 bg-orange-50'}`}>
                                                    <button type="button" onClick={() => openDocumentInViewer(doc)} className="flex-1 text-left"><div className="flex items-center gap-2"><FileText size={14} className="text-orange-500" /><span className="text-sm text-gray-700 truncate">{doc.label}</span></div></button>
                                                    <span className="text-xs font-bold text-orange-700">View</span>
                                                    {doc.category === 'skillCertificate' && <button type="button" onClick={() => deleteSkillCertificate(doc.url)} disabled={deletingSkillCertUrl === doc.url} className="p-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={10} /></button>}
                                                </div>
                                            ))}
                                        </div>
                                        <DocumentViewerCard />
                                    </div>
                                ) : <p className="text-gray-500 text-sm text-center py-8">No documents uploaded yet</p>}

                                <div className="mt-6 pt-4 border-t border-orange-100">
                                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2"><Camera size={14} className="text-orange-500" /> Portfolio Photos</h4>
                                    {profile.portfolioPhotos?.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {profile.portfolioPhotos.map((photo, idx) => (
                                                <div key={`portfolio-${idx}`} className="relative rounded-xl overflow-hidden border border-orange-100 hover:shadow-md">
                                                    <button type="button" onClick={() => openDocumentInViewer({ label: `Portfolio Photo ${idx + 1}`, url: photo })}><img src={getImageUrl(photo)} alt={`Portfolio ${idx + 1}`} className="w-full h-24 object-cover" /></button>
                                                    <button type="button" onClick={() => deletePortfolioPhoto(photo)} disabled={deletingPortfolioUrl === photo} className="absolute top-1 right-1 p-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200"><Trash2 size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-gray-500 text-sm">No portfolio photos uploaded.</p>}
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Portfolio Modal */}
                <AnimatePresence>
                    {showPortfolioModal && profile && (
                        <WorkerProfessionalPortfolio profile={profile} onClose={() => setShowPortfolioModal(false)} />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ViewProfile;