// client/src/pages/worker/DirectInvites.jsx  
// Premium Direct employment invites from clients

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MapPin, Clock, IndianRupee, Phone, Mail,
    CheckCircle, XCircle, RefreshCw, Sparkles, 
    Calendar, Briefcase, Zap, FileText, UserCircle,
    Verified, Award, TrendingUp, Star, Gift, AlertCircle,
    Navigation, Route, Home, Wallet, Building2, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    getImageUrl,
    getDirectInvites,
    getWorkerDirectHires,
    acceptDirectInvite,
    rejectDirectInvite,
    acceptDirectHireTicket,
    rejectDirectHireTicket,
} from '../../api/index';

export default function DirectInvites() {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvite, setSelectedInvite] = useState(null);
    const [responding, setResponding] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filter, setFilter] = useState('all');
    const [directHires, setDirectHires] = useState([]);
    const [directHireLoading, setDirectHireLoading] = useState(false);
    const [directHireDeclineReasons, setDirectHireDeclineReasons] = useState({});
    const [selectedDirectHire, setSelectedDirectHire] = useState(null);
    const [showDirectHireDetails, setShowDirectHireDetails] = useState(false);

    useEffect(() => {
        loadInvites();
    }, []);

    useEffect(() => {
        if (filter !== 'direct-hired' || directHires.length) return;
        loadDirectHires();
    }, [filter]);

    useEffect(() => {
        setShowDetails(false);
    }, [selectedInvite?.jobId]);

    const formatLocation = (location = {}) => {
        const fullAddress = String(location?.fullAddress || '').trim();
        if (fullAddress) return fullAddress;
        const parts = [location?.locality, location?.city, location?.state, location?.pincode]
            .map((part) => String(part || '').trim())
            .filter(Boolean);
        return parts.join(', ') || 'Location not specified';
    };

    const formatCommute = (commute) => {
        if (!commute) return 'Distance unavailable';
        if (!commute.available) return 'Location unavailable';
        const distance = commute.distanceText || `${Number(commute.distanceKm || 0).toFixed(1)} km`;
        const eta = commute.etaText ? `ETA ${commute.etaText}` : '';
        return [distance, eta].filter(Boolean).join(' • ');
    };

    const commuteTone = (commute) => {
        if (!commute?.available) return 'text-gray-400';
        if (commute.distanceColor === 'green') return 'text-emerald-600';
        if (commute.distanceColor === 'yellow') return 'text-amber-600';
        return 'text-rose-600';
    };

    const openGoogleMapsDirections = (lat, lng) => {
        if (lat && lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        } else {
            toast.error('Location coordinates not available');
        }
    };

    const loadInvites = async () => {
        try {
            setLoading(true);
            const { data } = await getDirectInvites();
            setInvites(data.invites || []);
        } catch (err) {
            console.error('Failed to load invites:', err);
            toast.error('Failed to load direct invites');
        } finally {
            setLoading(false);
        }
    };

    const loadDirectHires = async () => {
        try {
            setDirectHireLoading(true);
            const { data } = await getWorkerDirectHires();
            setDirectHires(data.jobs || []);
        } catch (err) {
            console.error('Failed to load direct hires:', err);
            toast.error('Failed to load direct hired jobs');
        } finally {
            setDirectHireLoading(false);
        }
    };

    const handleAccept = async (jobId) => {
        try {
            setResponding(jobId);
            const { data } = await acceptDirectInvite(jobId);
            toast.success(data.message || 'Invite accepted successfully!');
            setInvites(invites.filter(i => i.jobId !== jobId));
            setSelectedInvite(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to accept invite');
        } finally {
            setResponding(null);
        }
    };

    const handleReject = async (jobId) => {
        try {
            setResponding(jobId);
            const { data } = await rejectDirectInvite(jobId);
            toast.success(data.message || 'Invite declined');
            setInvites(invites.filter(i => i.jobId !== jobId));
            setSelectedInvite(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to decline invite');
        } finally {
            setResponding(null);
        }
    };

    const handleAcceptDirectHire = async (jobId) => {
        try {
            setResponding(jobId);
            const { data } = await acceptDirectHireTicket(jobId);
            toast.success(data.message || 'Direct hire accepted successfully!');
            setDirectHires((prev) => prev.filter(j => j._id !== jobId));
            setSelectedInvite(null);
            await loadDirectHires();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to accept direct hire');
        } finally {
            setResponding(null);
        }
    };

    const handleRejectDirectHire = async (jobId) => {
        const reason = String(directHireDeclineReasons[jobId] || '').trim();
        if (!reason || reason.length < 5) {
            toast.error('Please provide a reason for declining (minimum 5 characters).');
            return;
        }
        try {
            setResponding(jobId);
            const { data } = await rejectDirectHireTicket(jobId, { reason });
            toast.success(data.message || 'Direct hire declined');
            setDirectHires((prev) => prev.filter(j => j._id !== jobId));
            setSelectedInvite(null);
            setSelectedDirectHire(null);
            setDirectHireDeclineReasons((prev) => {
                const next = { ...prev };
                delete next[jobId];
                return next;
            });
            await loadDirectHires();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to decline direct hire');
        } finally {
            setResponding(null);
        }
    };

    const smartMatchInvites = invites.filter(i => String(i?.hireMode || '').toLowerCase() !== 'direct');
    const filtered = smartMatchInvites.filter(i => {
        if (filter === 'pending') return !i.hasApplied;
        if (filter === 'viewed') return i.hasApplied;
        return true;
    });
    const isDirectHiredTab = filter === 'direct-hired';
    const pendingCount = smartMatchInvites.filter(i => !i.hasApplied).length;
    const appliedCount = smartMatchInvites.filter(i => i.hasApplied).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 size="48" className="animate-spin text-orange-500 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Loading direct invites...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Sparkles size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Direct Invites</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Jobs where clients invited you directly</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                    <p className="text-2xl font-bold">{invites.length}</p>
                                    <p className="text-xs text-white/80">Total Invites</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-4 py-2 text-center">
                                    <p className="text-2xl font-bold">{pendingCount}</p>
                                    <p className="text-xs text-white/80">Pending Response</p>
                                </div>
                                <div className="bg-white/15 rounded-xl px-4 py-2 text-center hidden md:block">
                                    <p className="text-2xl font-bold">{directHires.length}</p>
                                    <p className="text-xs text-white/80">Direct Hired</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Tabs */}
                <div className="overflow-x-auto no-scrollbar mb-6 -mx-4 px-4">
                    <div className="flex items-center gap-2 min-w-max pb-1">
                        {[
                            { key: 'all', label: 'All Invites', count: invites.length, icon: Briefcase },
                            { key: 'pending', label: 'Pending', count: pendingCount, icon: Clock },
                            { key: 'viewed', label: 'Applied', count: appliedCount, icon: CheckCircle },
                            { key: 'direct-hired', label: 'Direct Hired', count: directHires.length, icon: Award }
                        ].map((tab) => {
                            const active = filter === tab.key;
                            const Icon = tab.icon;
                            return (
                                <motion.button
                                    key={tab.key}
                                    whileTap={{ scale: 0.96 }}
                                    onClick={() => setFilter(tab.key)}
                                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                        active
                                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600'
                                    }`}
                                >
                                    <Icon size="14" />
                                    {tab.label}
                                    {tab.count > 0 && (
                                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${
                                            active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </motion.button>
                            );
                        })}
                        <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={isDirectHiredTab ? loadDirectHires : loadInvites}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-gray-600 border border-gray-200 hover:border-orange-300 transition-all"
                        >
                            <RefreshCw size="14" /> Refresh
                        </motion.button>
                    </div>
                </div>

                {/* Main Content */}
                {isDirectHiredTab ? (
                    directHireLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size="40" className="animate-spin text-orange-500" />
                        </div>
                    ) : directHires.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Award size="36" className="text-emerald-400" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-xl mb-2">No Direct Hired Jobs</h3>
                            <p className="text-gray-400 text-sm">Accepted direct hire jobs will appear here</p>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {directHires.map((job) => {
                                const dh = job.directHire || {};
                                const isPending = String(dh.requestStatus || '') === 'requested';
                                const isRejected = String(dh.requestStatus || '') === 'rejected';
                                const rejectReason = String(directHireDeclineReasons[job._id] || '');

                                return (
                                    <motion.div
                                        key={job._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
                                    >
                                        <div className="p-5">
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={getImageUrl(job.postedBy?.photo)}
                                                    alt=""
                                                    className="w-12 h-12 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                                                        <h3 className="font-bold text-gray-800 text-base">{job.title}</h3>
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                            String(dh.requestStatus || '') === 'accepted'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                : String(dh.requestStatus || '') === 'rejected'
                                                                    ? 'bg-red-50 text-red-700 border-red-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {dh.requestStatus === 'accepted' ? '✓ Accepted' : 
                                                             dh.requestStatus === 'rejected' ? '✗ Declined' : '⏳ Pending'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <UserCircle size="12" /> {job.postedBy?.name}
                                                    </p>

                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                            <Calendar size="12" className="text-orange-400" />
                                                            <span>{job.scheduledDate ? new Date(job.scheduledDate).toLocaleDateString() : 'Date TBD'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                            <Clock size="12" className="text-orange-400" />
                                                            <span>{job.scheduledTime || 'Time TBD'}</span>
                                                        </div>
                                                        {!isRejected && (
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                                <Wallet size="12" className="text-orange-400" />
                                                                <span className="font-semibold text-emerald-600">₹{Number(dh.expectedAmount || 0).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                            <Clock size="12" className="text-orange-400" />
                                                            <span>{Number(dh.durationValue || 1)} {dh.durationUnit || '/hour'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                                        <p className="text-xs text-gray-600 line-clamp-2">
                                                            <span className="font-semibold">Job Description:</span> {dh.oneLineJD || job.shortDescription || job.description || 'Not available'}
                                                        </p>
                                                    </div>

                                                    <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                                                        <MapPin size="12" className="flex-shrink-0 mt-0.5" />
                                                        <span className="truncate">{formatLocation(job.location)}</span>
                                                    </div>

                                                    {isRejected && dh.requestRejectedReason && (
                                                        <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                                                            <p className="text-xs text-red-600">
                                                                <span className="font-semibold">Decline reason:</span> {dh.requestRejectedReason}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                                                <button
                                                    onClick={() => {
                                                        setSelectedDirectHire(job);
                                                        setShowDirectHireDetails(true);
                                                    }}
                                                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all"
                                                >
                                                    <Eye size="12" className="inline mr-1" /> View Details
                                                </button>

                                                {isPending && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAcceptDirectHire(job._id)}
                                                            disabled={responding === job._id}
                                                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
                                                        >
                                                            {responding === job._id ? (
                                                                <Loader2 size="12" className="animate-spin inline mr-1" />
                                                            ) : (
                                                                <CheckCircle size="12" className="inline mr-1" />
                                                            )}
                                                            Accept Offer
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectDirectHire(job._id)}
                                                            disabled={responding === job._id}
                                                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all"
                                                        >
                                                            <XCircle size="12" className="inline mr-1" />
                                                            Decline
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                            {isPending && (
                                                <div className="mt-3">
                                                    <textarea
                                                        value={rejectReason}
                                                        onChange={(e) => setDirectHireDeclineReasons((prev) => ({ ...prev, [job._id]: e.target.value }))}
                                                        placeholder="Reason for declining (required, min 5 characters)..."
                                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
                                                        rows={2}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                    >
                        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Mail size="36" className="text-orange-400" />
                        </div>
                        <h3 className="font-bold text-gray-800 text-xl mb-2">
                            {filter === 'pending' ? 'No Pending Invites' : 'No Invites Yet'}
                        </h3>
                        <p className="text-gray-400 text-sm">When clients invite you directly, they'll appear here</p>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Invite Cards */}
                        <div className="lg:col-span-2 space-y-4">
                            <AnimatePresence>
                                {filtered.map((invite) => (
                                    <motion.button
                                        key={invite.jobId}
                                        onClick={() => setSelectedInvite(invite)}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className={`w-full text-left bg-white rounded-xl border-2 transition-all p-5 ${
                                            selectedInvite?.jobId === invite.jobId
                                                ? 'border-orange-400 shadow-lg'
                                                : 'border-gray-100 shadow-md hover:shadow-xl hover:border-orange-200'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            <img
                                                src={getImageUrl(invite.postedBy?.photo)}
                                                alt=""
                                                className="w-12 h-12 rounded-xl object-cover border-2 border-orange-200 shadow-sm"
                                                onError={e => { e.target.src = '/admin.png'; }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-800 text-base truncate">{invite.title}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-xs text-gray-500 truncate">{invite.postedBy?.name}</span>
                                                    {invite.postedBy?.verificationStatus === 'approved' && (
                                                        <Verified size="12" className="text-emerald-500" />
                                                    )}
                                                </div>
                                            </div>
                                            {invite.hasApplied && (
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-200">
                                                    <CheckCircle size="10" /> Applied
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">{invite.description}</p>

                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <Wallet size="11" className="text-orange-400" />
                                                <span className="font-semibold text-emerald-600">₹{Number(invite.invitedSkillCost || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <Clock size="11" className="text-orange-400" />
                                                <span>{invite.invitedDuration || 'Duration'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <Calendar size="11" className="text-orange-400" />
                                                <span>{invite.scheduledDate ? new Date(invite.scheduledDate).toLocaleDateString() : 'Date'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                <Clock size="11" className="text-orange-400" />
                                                <span>{invite.scheduledTime || 'Time'}</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="px-2 py-1 bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 capitalize flex items-center gap-1">
                                                <Star size="10" /> {invite.invitedSkill || 'Selected skill'}
                                            </span>
                                            {invite.invitedNegotiationAmount && (
                                                <span className="px-2 py-1 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 rounded-lg text-xs font-semibold border border-orange-200 flex items-center gap-1">
                                                    <Gift size="10" /> Negotiable: ₹{Number(invite.invitedNegotiationAmount).toLocaleString()}
                                                </span>
                                            )}
                                            {invite.urgent && (
                                                <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold border border-red-200 flex items-center gap-1">
                                                    <Zap size="10" /> Urgent
                                                </span>
                                            )}
                                        </div>

                                        <div className={`text-xs font-medium flex items-center gap-1 ${commuteTone(invite?.commute)}`}>
                                            <Route size="11" />
                                            <span className="truncate">{formatCommute(invite?.commute)}</span>
                                            {invite?.commute?.isLocationStale && (
                                                <span className="text-gray-400 text-[10px]">• stale</span>
                                            )}
                                        </div>
                                    </motion.button>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* Detail Panel */}
                        {selectedInvite && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="lg:col-span-1"
                            >
                                <div className="bg-white rounded-xl border-2 border-orange-200 shadow-xl sticky top-24 overflow-hidden">
                                    {/* Panel Header */}
                                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-white font-bold text-base truncate">{selectedInvite.title}</h3>
                                                <p className="text-white/80 text-xs mt-0.5">Invitation Details</p>
                                            </div>
                                            <button
                                                onClick={() => setSelectedInvite(null)}
                                                className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-5 max-h-[calc(100vh-200px)] overflow-y-auto">
                                        {/* Client Info */}
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-100">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                <UserCircle size="12" /> Client
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={getImageUrl(selectedInvite.postedBy?.photo)}
                                                    alt=""
                                                    className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-md"
                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                />
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-800 text-sm">{selectedInvite.postedBy?.name}</p>
                                                    <p className="text-[10px] text-gray-500">{selectedInvite.postedBy?.karigarId}</p>
                                                    {selectedInvite.postedBy?.mobile && (
                                                        <a href={`tel:${selectedInvite.postedBy.mobile}`} className="text-xs text-blue-600 font-medium inline-flex items-center gap-1 mt-1">
                                                            <Phone size="10" /> {selectedInvite.postedBy.mobile}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Job Details */}
                                        <div className="space-y-3 mb-4">
                                            <div className="flex items-start gap-2">
                                                <MapPin size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Location</p>
                                                    <p className="text-xs text-gray-700">{formatLocation(selectedInvite.location)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <Route size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Travel Info</p>
                                                    <p className={`text-xs font-medium ${commuteTone(selectedInvite?.commute)}`}>{formatCommute(selectedInvite?.commute)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <Wallet size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Estimated Earnings</p>
                                                    <p className="text-sm font-bold text-emerald-600">₹{Number(selectedInvite.invitedSkillCost || 0).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <Clock size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Duration</p>
                                                    <p className="text-xs font-semibold text-gray-800">{selectedInvite.invitedDuration || 'Not specified'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <Calendar size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Schedule</p>
                                                    <p className="text-xs font-semibold text-gray-800">
                                                        {selectedInvite.scheduledDate ? new Date(selectedInvite.scheduledDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Date not set'}
                                                        {selectedInvite.scheduledTime ? ` at ${selectedInvite.scheduledTime}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-2">
                                                <Star size="14" className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Your Invited Skill</p>
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold border border-purple-200 capitalize">
                                                            {selectedInvite.invitedSkill || 'Not specified'}
                                                        </span>
                                                        {selectedInvite.invitedNegotiationAmount && (
                                                            <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-semibold border border-orange-200">
                                                                🤝 Negotiable: ₹{Number(selectedInvite.invitedNegotiationAmount).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase mb-1.5 flex items-center gap-1">
                                                <FileText size="12" /> About This Job
                                            </p>
                                            <p className="text-xs text-gray-700 leading-relaxed">{selectedInvite.description}</p>
                                        </div>

                                        {/* Actions */}
                                        {!selectedInvite.hasApplied ? (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => setShowDetails(true)}
                                                    className="w-full px-4 py-2.5 bg-white text-indigo-700 border border-indigo-200 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
                                                >
                                                    <Eye size="14" />
                                                    View Full Details
                                                </button>
                                                <button
                                                    onClick={() => handleAccept(selectedInvite.jobId)}
                                                    disabled={responding === selectedInvite.jobId}
                                                    className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-md disabled:opacity-60"
                                                >
                                                    {responding === selectedInvite.jobId ? (
                                                        <Loader2 size="14" className="animate-spin" />
                                                    ) : (
                                                        <CheckCircle size="14" />
                                                    )}
                                                    Accept Invite
                                                </button>
                                                <button
                                                    onClick={() => handleReject(selectedInvite.jobId)}
                                                    disabled={responding === selectedInvite.jobId}
                                                    className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-200 transition-all disabled:opacity-60"
                                                >
                                                    <XCircle size="14" />
                                                    Decline
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                                <CheckCircle size="18" className="inline mb-1 text-emerald-600" />
                                                <p className="text-xs font-semibold text-emerald-700">You have already applied for this job</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* Full Details Modal */}
                <AnimatePresence>
                    {showDetails && selectedInvite && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setShowDetails(false)}
                        >
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 20, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
                                    <h4 className="text-white font-bold text-lg">Job Details</h4>
                                    <button onClick={() => setShowDetails(false)} className="text-white/80 hover:text-white text-sm font-semibold">✕ Close</button>
                                </div>
                                <div className="p-6 overflow-y-auto max-h-[calc(88vh-80px)] space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Job Title</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedInvite.title}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Category</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedInvite.category || '—'}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Schedule</p>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {selectedInvite.scheduledDate ? new Date(selectedInvite.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date not set'}
                                                {selectedInvite.scheduledTime ? ` at ${selectedInvite.scheduledTime}` : ''}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Invited Skill</p>
                                            <p className="text-sm font-semibold text-gray-800 capitalize">{selectedInvite.invitedSkill || '—'}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Estimated Earnings</p>
                                            <p className="text-sm font-bold text-emerald-600">₹{Number(selectedInvite.invitedSkillCost || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Duration</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedInvite.invitedDuration || '—'}</p>
                                        </div>
                                    </div>

                                    {selectedInvite.invitedNegotiationAmount && (
                                        <div className="rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
                                            <p className="text-[10px] text-orange-700 uppercase font-bold">Negotiable Amount</p>
                                            <p className="text-lg font-bold text-orange-700">₹{Number(selectedInvite.invitedNegotiationAmount).toLocaleString()}</p>
                                            <p className="text-[11px] text-orange-600 mt-1">Client has indicated this amount is negotiable</p>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <MapPin size="12" /> Location Details
                                        </p>
                                        <p className="text-sm text-gray-700">{formatLocation(selectedInvite.location)}</p>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <Route size="12" /> Travel Information
                                        </p>
                                        <p className={`text-sm font-semibold ${commuteTone(selectedInvite?.commute)}`}>{formatCommute(selectedInvite?.commute)}</p>
                                        {selectedInvite?.commute?.isLocationStale && (
                                            <p className="text-xs text-amber-600 mt-1">⚠️ Live location is stale. Update your location for better ETA.</p>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <FileText size="12" /> Full Description
                                        </p>
                                        <p className="text-sm text-gray-700 leading-relaxed">{selectedInvite.detailedDescription || selectedInvite.description || 'No additional details provided.'}</p>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Direct Hire Details Modal */}
                <AnimatePresence>
                    {showDirectHireDetails && selectedDirectHire && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={() => setShowDirectHireDetails(false)}
                        >
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 20, opacity: 0 }}
                                className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
                                    <h4 className="text-white font-bold text-lg">Direct Hire Details</h4>
                                    <button onClick={() => setShowDirectHireDetails(false)} className="text-white/80 hover:text-white text-sm font-semibold">✕ Close</button>
                                </div>
                                <div className="p-6 overflow-y-auto max-h-[calc(88vh-80px)] space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Job Title</p>
                                            <p className="text-sm font-bold text-gray-900">{selectedDirectHire.title}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Status</p>
                                            <p className={`text-sm font-bold capitalize ${
                                                selectedDirectHire.directHire?.requestStatus === 'accepted' ? 'text-emerald-600' :
                                                selectedDirectHire.directHire?.requestStatus === 'rejected' ? 'text-red-600' : 'text-amber-600'
                                            }`}>
                                                {selectedDirectHire.directHire?.requestStatus || 'requested'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Schedule</p>
                                            <p className="text-sm font-semibold text-gray-800">
                                                {selectedDirectHire.scheduledDate ? new Date(selectedDirectHire.scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date not set'}
                                                {selectedDirectHire.scheduledTime ? ` at ${selectedDirectHire.scheduledTime}` : ''}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Amount</p>
                                            <p className="text-lg font-bold text-emerald-600">₹{Number(selectedDirectHire.directHire?.expectedAmount || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Duration</p>
                                            <p className="text-sm font-semibold text-gray-800">{Number(selectedDirectHire.directHire?.durationValue || 1)} {selectedDirectHire.directHire?.durationUnit || '/hour'}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-4">
                                            <p className="text-[10px] text-gray-500 uppercase font-bold">Client</p>
                                            <p className="text-sm font-semibold text-gray-800">{selectedDirectHire.postedBy?.name || 'Client'}</p>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <MapPin size="12" /> Location
                                        </p>
                                        <p className="text-sm text-gray-700">{formatLocation(selectedDirectHire.location)}</p>
                                        {Number.isFinite(Number(selectedDirectHire.location?.lat)) && Number.isFinite(Number(selectedDirectHire.location?.lng)) && (
                                            <button
                                                onClick={() => openGoogleMapsDirections({ lat: selectedDirectHire.location.lat, lng: selectedDirectHire.location.lng })}
                                                className="mt-3 inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:underline"
                                            >
                                                <Navigation size="12" /> Get Directions
                                            </button>
                                        )}
                                    </div>

                                    <div className="rounded-xl border border-gray-200 p-4">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                                            <FileText size="12" /> Job Description
                                        </p>
                                        <p className="text-sm text-gray-700 leading-relaxed">{selectedDirectHire.directHire?.oneLineJD || selectedDirectHire.shortDescription || selectedDirectHire.description || 'No details provided.'}</p>
                                    </div>

                                    {selectedDirectHire.directHire?.requestRejectedReason && (
                                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                                            <p className="text-[10px] text-red-700 uppercase font-bold flex items-center gap-1">
                                                <AlertCircle size="12" /> Decline Reason
                                            </p>
                                            <p className="text-sm text-red-700 mt-1">{selectedDirectHire.directHire.requestRejectedReason}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Helper component for Loader
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

// Helper for Eye icon
const Eye = ({ size, className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);