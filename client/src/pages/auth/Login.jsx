// client/src/pages/auth/Login.jsx
// PREMIUM VERSION - Modern design with orange/amber theme, smooth animations
// All original functionality preserved including shop owner login on same page

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, Eye, EyeOff, ArrowRight, Sparkles, Shield, 
  User, Briefcase, Building2, Lock, Smartphone, 
  Mail, CheckCircle, AlertCircle, Crown, Diamond,
  Zap, Gift, Heart, ThumbsUp, TrendingUp, Award
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// STABLE sub-components — defined OUTSIDE Login component so they are never
// re-created on re-render, fixing the "must click input each time" bug.
// ─────────────────────────────────────────────────────────────────────────────

const TextInput = ({ label, type, placeholder, value, onChange,
    required, maxLength, prefix, rightSlot, autoComplete = 'off', name, inputMode }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {label}
            </label>
        )}
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-4 text-gray-400 text-sm font-medium select-none pointer-events-none z-10">
                    {prefix}
                </span>
            )}
            <input
                type={type || 'text'}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                maxLength={maxLength}
                autoComplete={autoComplete}
                inputMode={inputMode}
                className={[
                    'w-full border border-gray-200 rounded-xl py-3 pr-12 bg-gray-50 text-gray-800',
                    'placeholder:text-gray-300 text-sm font-medium',
                    'focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none focus:bg-white',
                    'transition-all duration-200',
                    prefix ? 'pl-11' : 'pl-4',
                ].join(' ')}
            />
            {rightSlot && (
                <div className="absolute right-3 z-10">{rightSlot}</div>
            )}
        </div>
    </div>
);

const MethodToggle = ({ method, onChange }) => (
    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {['password', 'otp'].map(m => (
            <button key={m} type="button" onClick={() => onChange(m)}
                className={[
                    'flex-1 py-2.5 rounded-lg text-xs font-bold transition-all',
                    method === m
                        ? 'bg-white shadow-sm text-orange-700 border border-orange-200'
                        : 'text-gray-500 hover:text-orange-600',
                ].join(' ')}>
                {m === 'password' ? '🔑 Password' : '📱 OTP Login'}
            </button>
        ))}
    </div>
);

const SubmitBtn = ({ loading, gradient, children, icon: Icon }) => (
    <motion.button 
        whileTap={{ scale: 0.98 }}
        type="submit" 
        disabled={loading}
        className={[
            'w-full bg-gradient-to-r text-white py-3.5 rounded-xl font-bold text-sm',
            'hover:shadow-lg hover:shadow-orange-200 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2',
            gradient,
        ].join(' ')}>
        {loading ? (
            <>
                <Loader2 size="16" className="animate-spin" />
                <span>Logging in...</span>
            </>
        ) : (
            <>
                {Icon && <Icon size="16" />}
                <span>{children}</span>
                <ArrowRight size="14" className="group-hover:translate-x-1 transition-transform" />
            </>
        )}
    </motion.button>
);

// ── Standard login (worker / client / admin) ──────────────────────────────────
const StandardForm = ({ role, gradient, onSuccess }) => {
    const [method, setMethod]     = useState('password');
    const [mobile, setMobile]     = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd]   = useState(false);
    const [otp, setOtp]           = useState('');
    const [otpSent, setOtpSent]   = useState(false);
    const [loading, setLoading]   = useState(false);

    const onMobileChange   = useCallback(e => setMobile(e.target.value.replace(/\D/g, '')), []);
    const onPasswordChange = useCallback(e => setPassword(e.target.value), []);
    const onOtpChange      = useCallback(e => setOtp(e.target.value.replace(/\D/g, '')), []);
    const togglePwd        = useCallback(() => setShowPwd(v => !v), []);
    const handleMethodChange = useCallback(m => setMethod(m), []);

    const sendOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile.');
        setLoading(true);
        try {
            await api.sendOtp({ mobile, type: 'login', role });
            setOtpSent(true);
            toast.success('OTP sent to your mobile!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to send OTP.');
        } finally { setLoading(false); }
    }, [mobile, role]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        const tid = toast.loading('Logging in...');
        try {
            const res = method === 'password'
                ? await api.loginWithPassword({ role, mobile, password })
                : await api.loginWithOtp({ role, mobile, otp });
            const { data } = res;
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.user.role);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Login successful!', { id: tid });
            onSuccess(data.user.role);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Login failed.', { id: tid });
        } finally { setLoading(false); }
    }, [role, mobile, password, otp, method, onSuccess]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <TextInput label="Mobile Number" type="tel" placeholder="10-digit mobile"
            value={mobile} onChange={onMobileChange} required maxLength={10} prefix="+91"
            name={`mobile_${role}`} autoComplete="off" inputMode="numeric" />

            {role !== 'admin' && <MethodToggle method={method} onChange={handleMethodChange} />}

            {method === 'password' ? (
                <>
                    <TextInput
                        label="Password" type={showPwd ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password} onChange={onPasswordChange} required
                        name={`login_${role}_password`}
                        autoComplete="new-password"
                        rightSlot={
                            <button type="button" onClick={togglePwd}
                                className="text-gray-400 hover:text-gray-700 p-1">
                                {showPwd ? <EyeOff size="15"/> : <Eye size="15"/>}
                            </button>
                        }
                    />
                    {role !== 'admin' && (
                        <div className="text-right -mt-2">
                            <Link to="/forgot-password"
                                className="text-xs text-orange-500 hover:text-orange-700 font-semibold">
                                Forgot Password?
                            </Link>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <TextInput label="OTP" type="text" placeholder="6-digit OTP"
                            value={otp} onChange={onOtpChange} required maxLength={6}
                            name={`otp_${role}`} autoComplete="one-time-code" inputMode="numeric" />
                    </div>
                    <button type="button" onClick={sendOtp} disabled={loading}
                        className="shrink-0 px-4 py-3.5 bg-orange-100 hover:bg-orange-200 text-orange-700
                            rounded-xl text-xs font-bold border border-orange-200 disabled:opacity-50 transition-all whitespace-nowrap">
                        {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                </div>
            )}

            <SubmitBtn loading={loading} gradient={`from-${gradient}-500 to-${gradient}-600`} icon={Sparkles}>
                Login to Account
            </SubmitBtn>
        </form>
    );
};

// ── Shop owner login form ─────────────────────────────────────────────────────
const ShopForm = ({ onSuccess }) => {
    const [method, setMethod]     = useState('password');
    const [mobile, setMobile]     = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd]   = useState(false);
    const [otp, setOtp]           = useState('');
    const [otpSent, setOtpSent]   = useState(false);
    const [loading, setLoading]   = useState(false);

    const onMobileChange   = useCallback(e => setMobile(e.target.value.replace(/\D/g, '')), []);
    const onPasswordChange = useCallback(e => setPassword(e.target.value), []);
    const onOtpChange      = useCallback(e => setOtp(e.target.value.replace(/\D/g, '')), []);
    const togglePwd        = useCallback(() => setShowPwd(v => !v), []);
    const handleMethodChange = useCallback(m => setMethod(m), []);

    const sendOtp = useCallback(async () => {
        if (!mobile || mobile.length !== 10) return toast.error('Enter valid 10-digit mobile.');
        setLoading(true);
        try {
            await api.shopSendLoginOtp({ mobile });
            setOtpSent(true);
            toast.success('OTP sent to your mobile!');
        } catch (e) {
            const errMsg = e.response?.data?.message;
            if (e.response?.data?.notRegistered) {
                toast.error('This mobile is not registered. Please register first.');
            } else {
                toast.error(errMsg || 'Failed to send OTP.');
            }
        } finally { setLoading(false); }
    }, [mobile]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setLoading(true);
        const tid = toast.loading('Logging in...');
        try {
            let res;
            if (method === 'password') {
                res = await api.shopLogin({ mobile, password });
            } else {
                res = await api.shopVerifyLoginOtp({ mobile, otp });
            }
            const { data } = res;
            localStorage.setItem('shopToken', data.token);
            localStorage.setItem('shopRole', 'shop');
            localStorage.setItem('shop', JSON.stringify(data.shop));
            toast.success('Login successful!', { id: tid });
            onSuccess('shop');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Login failed.', { id: tid });
        } finally { setLoading(false); }
    }, [mobile, password, otp, method, onSuccess]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <TextInput label="Registered Mobile" type="tel" placeholder="Shop mobile number"
                value={mobile} onChange={onMobileChange} required maxLength={10} prefix="+91"
                name="shop_mobile" autoComplete="off" inputMode="numeric" />
            
            <MethodToggle method={method} onChange={handleMethodChange} />

            {method === 'password' ? (
                <TextInput
                    label="Password" type={showPwd ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password} onChange={onPasswordChange} required
                    name="shop_login_password"
                    autoComplete="new-password"
                    rightSlot={
                        <button type="button" onClick={togglePwd}
                            className="text-gray-400 hover:text-gray-700 p-1">
                            {showPwd ? <EyeOff size="15"/> : <Eye size="15"/>}
                        </button>
                    }
                />
            ) : (
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <TextInput label="OTP" type="text" placeholder="6-digit OTP"
                            value={otp} onChange={onOtpChange} required maxLength={6}
                            name="shop_otp" autoComplete="one-time-code" inputMode="numeric" />
                    </div>
                    <button type="button" onClick={sendOtp} disabled={loading}
                        className="shrink-0 px-4 py-3.5 bg-teal-100 hover:bg-teal-200 text-teal-700
                            rounded-xl text-xs font-bold border border-teal-200 disabled:opacity-50 transition-all whitespace-nowrap">
                        {otpSent ? 'Resend' : 'Send OTP'}
                    </button>
                </div>
            )}

            <SubmitBtn loading={loading} gradient="from-teal-500 to-emerald-600" icon={Store}>
                Login to Shop Dashboard
            </SubmitBtn>
            <p className="text-center text-xs text-gray-500">
                New shop?{' '}
                <Link to="/shop/register" className="text-teal-600 font-bold hover:underline">
                    Register your shop
                </Link>
            </p>
        </form>
    );
};

// ── Role config ───────────────────────────────────────────────────────────────
const ROLES = [
    { key: 'worker', label: 'Karigar',  emoji: '🔨', color: 'orange',  headerGrad: 'from-orange-500 to-amber-500', icon: Briefcase },
    { key: 'client', label: 'Client',   emoji: '👤', color: 'amber',   headerGrad: 'from-amber-500 to-orange-500',  icon: User },
    { key: 'admin',  label: 'Admin',    emoji: '🛡️', color: 'gray',    headerGrad: 'from-gray-700 to-gray-900',     icon: Shield },
    { key: 'shop',   label: 'Shop',     emoji: null,  color: 'teal',    headerGrad: 'from-teal-500 to-emerald-600',  icon: Store },
];

const IMAGES = {
    worker: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1032&q=80',
    client: 'https://images.unsplash.com/photo-1568992687947-868a62a9f521?auto=format&fit=crop&w=1032&q=80',
    admin:  'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1032&q=80',
    shop:   'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1032&q=80',
};

const HEADLINES = {
    worker: ['Skilled Workers Platform', 'Connect with clients and grow your business'],
    client: ['Find Trusted Professionals', 'Hire verified professionals for all your needs'],
    admin:  ['Admin Management Portal', 'Manage the platform and ensure smooth operations'],
    shop:   ['Partner Shop Portal', 'Sell tools to verified workers with exclusive discounts'],
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
const Login = () => {
    const navigate  = useNavigate();
    const [role, setRole] = useState('worker');

    const handleRoleChange = useCallback(key => setRole(key), []);
    const handleSuccess = useCallback(userRole => {
        if (userRole === 'worker') {
            sessionStorage.setItem('kc_worker_login_fresh', '1');
        }
        const paths = { admin: '/admin/dashboard', worker: '/worker/dashboard', shop: '/shop/dashboard' };
        navigate(paths[userRole] || '/client/dashboard');
    }, [navigate]);

    const current = ROLES.find(r => r.key === role);
    const [hl, sub] = HEADLINES[role];
    const Icon = current.icon;

    return (
        <div className="min-h-screen flex bg-white">
            {/* ── LEFT SIDE ── */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full lg:w-[44%] flex flex-col justify-center px-6 py-10 lg:px-12 bg-gradient-to-br from-orange-50/30 via-white to-orange-50/20"
            >
                {/* Brand */}
                <div className="mb-8">
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 rounded-full mb-4 shadow-sm"
                    >
                        <Sparkles size="12" className="text-white" />
                        <span className="text-white text-xs font-black uppercase tracking-wider">KarigarConnect</span>
                    </motion.div>
                    <h1 className="text-3xl lg:text-4xl font-black text-gray-800 tracking-tight">Welcome back 👋</h1>
                    <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
                </div>

                {/* Role Selector */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {ROLES.map(r => (
                        <motion.button
                            key={r.key}
                            whileTap={{ scale: 0.95 }}
                            type="button"
                            onClick={() => handleRoleChange(r.key)}
                            className={[
                                'flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl border-2 text-[10px] font-bold',
                                'transition-all duration-200 select-none',
                                role === r.key
                                    ? `bg-gradient-to-r ${r.headerGrad} border-transparent text-white shadow-lg`
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-orange-300 hover:bg-orange-50',
                            ].join(' ')}>
                            {r.key === 'shop' || r.icon ? (
                                <r.icon size="16" className={role === r.key ? 'text-white' : 'text-gray-500'} />
                            ) : (
                                <span className="text-lg leading-none">{r.emoji}</span>
                            )}
                            <span className="text-[11px]">{r.label}</span>
                            {role === r.key && (
                                <motion.div 
                                    layoutId="activeRole"
                                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white"
                                />
                            )}
                        </motion.button>
                    ))}
                </div>

                {/* Form Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                >
                    <div className={`bg-gradient-to-r ${current.headerGrad} px-6 py-4`}>
                        <div className="flex items-center gap-2">
                            <Icon size="18" className="text-white" />
                            <h2 className="text-white font-bold text-base">
                                {role === 'shop' ? 'Shop Owner Login' :
                                 role === 'admin' ? 'Admin Portal' :
                                 role === 'worker' ? 'Karigar Login' : 'Client Login'}
                            </h2>
                        </div>
                        <p className="text-white/70 text-xs mt-0.5">
                            {role === 'shop' ? 'Access your shop dashboard' : 'Enter your credentials to continue'}
                        </p>
                    </div>
                    <div className="p-6">
                        {role === 'shop'
                            ? <ShopForm onSuccess={handleSuccess} />
                            : <StandardForm role={role} gradient={current.color} onSuccess={handleSuccess} />
                        }
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        Don't have an account?{' '}
                        <Link to="/register" className="font-bold text-orange-600 hover:text-orange-700 transition-colors">
                            Register now
                        </Link>
                    </p>
                </div>
            </motion.div>

            {/* ── RIGHT SIDE ── */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7 }}
                className="hidden lg:block lg:flex-1 relative overflow-hidden"
            >
                <img src={IMAGES[role]} alt={role}
                    className="absolute inset-0 w-full h-full object-cover transition-all duration-700 transform scale-105 hover:scale-100" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                <div className="relative z-10 h-full flex flex-col justify-end p-14">
                    <motion.div 
                        key={role}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="max-w-md"
                    >
                        <div className="mb-4">
                            <motion.div 
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 0.5, delay: 0.5 }}
                                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 mb-3"
                            >
                                {role === 'worker' && <Briefcase size="12" className="text-white" />}
                                {role === 'client' && <User size="12" className="text-white" />}
                                {role === 'admin' && <Shield size="12" className="text-white" />}
                                {role === 'shop' && <Store size="12" className="text-white" />}
                                <span className="text-white text-xs font-semibold uppercase tracking-wider">
                                    {role === 'worker' ? 'For Karigars' : role === 'client' ? 'For Clients' : role === 'admin' ? 'For Admins' : 'For Shop Owners'}
                                </span>
                            </motion.div>
                        </div>
                        <h2 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-tight mb-4">
                            {hl}
                        </h2>
                        <p className="text-white/80 text-base lg:text-lg leading-relaxed max-w-md">
                            {sub}
                        </p>
                        
                        {/* Feature Highlights */}
                        <div className="mt-6 flex gap-4">
                            {[1, 2, 3].map((_, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    className="flex items-center gap-1.5"
                                >
                                    <CheckCircle size="12" className="text-emerald-400" />
                                    <span className="text-white/70 text-xs">
                                        {role === 'worker' ? 'Verified Jobs' : role === 'client' ? 'Trusted Workers' : 'Full Control'}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
};

// Helper Loader Component
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

export default Login;