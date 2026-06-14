import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronDown, Menu, X, Home, LayoutDashboard, LogOut, User, 
    Settings, CreditCard, Bell, Sparkles, Globe, Check, Shield, 
    Award, Star, TrendingUp, Zap, Crown, HelpCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';
import logo from '../assets/logo.jpg';
import NotificationBell from '../components/NotificationBell';
import { getImageUrl } from '../utils/imageUrl';

// ─── Language Switcher (Enhanced) ────────────────────────────────────────────
const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English', flag: '🇬🇧', icon: '🌎' },
    { code: 'hi', label: 'Hindi',   native: 'हिन्दी',  flag: '🇮🇳', icon: '🇮🇳' },
    { code: 'mr', label: 'Marathi', native: 'मराठी',   flag: '🇮🇳', icon: '🇮🇳' },
];

const LanguageSwitcher = () => {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(LANGUAGES[0]);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const match = document.cookie.match(/googtrans=\/en\/(\w+)/);
        if (match) {
            const found = LANGUAGES.find((l) => l.code === match[1]);
            if (found) setSelected(found);
        }
    }, []);

    const changeLanguage = (lang) => {
        setSelected(lang);
        setOpen(false);

        if (lang.code === 'en') {
            document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
            window.location.reload();
            return;
        }

        const cookieValue = `/en/${lang.code}`;
        document.cookie = `googtrans=${cookieValue}; path=/`;
        document.cookie = `googtrans=${cookieValue}; path=/; domain=${window.location.hostname}`;

        const select = document.querySelector('.goog-te-combo');
        if (select) {
            select.value = lang.code;
            select.dispatchEvent(new Event('change'));
        } else {
            window.location.reload();
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <motion.button
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-300 group"
                title="Change Language"
            >
                <motion.div
                    animate={{ rotate: open ? 360 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <Globe size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
                </motion.div>
                <span className="text-xs font-semibold text-gray-700 hidden sm:inline">
                    {selected.native}
                </span>
                <span className="text-sm sm:hidden">{selected.flag}</span>
                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown size={12} className="text-gray-400" />
                </motion.div>
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden"
                    >
                        <div className="px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                                Select Language
                            </p>
                        </div>
                        {LANGUAGES.map((lang, idx) => (
                            <motion.button
                                key={lang.code}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                onClick={() => changeLanguage(lang)}
                                className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200 group"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl group-hover:scale-110 transition-transform">{lang.flag}</span>
                                    <div className="text-left">
                                        <p className="font-semibold text-gray-800 text-sm">{lang.native}</p>
                                        <p className="text-xs text-gray-400">{lang.label}</p>
                                    </div>
                                </div>
                                {selected.code === lang.code && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"
                                    >
                                        <Check size={12} className="text-white" />
                                    </motion.div>
                                )}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Enhanced Header ─────────────────────────────────────────────────────────
const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Check for both regular user and shop owner tokens
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const shopToken = localStorage.getItem('shopToken');
    const shopRole = localStorage.getItem('shopRole');
    const shopData = JSON.parse(localStorage.getItem('shop') || '{}');
    
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // Determine actual authentication status
    const isShopOwnerLoggedIn = shopToken && shopRole;
    const isUserLoggedIn = token && role;
    const isLoggedIn = isUserLoggedIn || isShopOwnerLoggedIn;
    const currentRole = shopRole || role;
    const currentUser = shopData.shopName ? { name: shopData.shopName } : user;

    const [isAvailable, setIsAvailable] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [notifications, setNotifications] = useState(3);
    const [workerRating, setWorkerRating] = useState(0);
    const [totalRatings, setTotalRatings] = useState(0);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (role === 'worker') {
            const fetchProfile = async () => {
                try {
                    const { data } = await api.getWorkerProfile();
                    setIsAvailable(data.availability);
                    setWorkerRating(data.averageRating || 0);
                    setTotalRatings(data.totalRatings || 0);
                } catch {
                    console.error('Could not fetch initial availability status.');
                }
            };
            fetchProfile();
        }
    }, [role]);

    let dashboardLink = '/';
    if (isShopOwnerLoggedIn) dashboardLink = '/shop/dashboard';
    else if (role === 'worker') dashboardLink = '/worker/dashboard';
    else if (role === 'client') dashboardLink = '/client/dashboard';
    else if (role === 'admin') dashboardLink = '/admin/dashboard';

    const handleLogout = () => {
        [
            'token',
            'role',
            'user',
            'shopToken',
            'shopRole',
            'shop',
        ].forEach((key) => localStorage.removeItem(key));
        navigate('/login');
        toast.success('You have been logged out.', {
            icon: '👋',
            style: { background: '#ffedd5', color: '#9a3412' }
        });
    };

    const toggleAvailability = async () => {
        const previousState = isAvailable;
        setIsAvailable(!previousState);
        try {
            const { data } = await api.toggleAvailability();
            setIsAvailable(data.availability);
            toast.success(data.availability ? '🎉 You are now available for work!' : '💤 You are now offline', {
                icon: data.availability ? '✅' : '🌙',
                style: { background: '#ffedd5', color: '#9a3412' }
            });
        } catch {
            setIsAvailable(previousState);
            toast.error('Failed to update availability. Please try again.');
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownOpen && !event.target.closest('.profile-menu')) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const isActive = (path) => location.pathname === path;

    const navLinkClass = (path) => `
        relative px-3 lg:px-4 py-2 text-sm font-semibold transition-all duration-300 
        ${isActive(path) 
            ? 'text-orange-600' 
            : 'text-gray-700 hover:text-orange-600'
        } group whitespace-nowrap
    `;

    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`sticky top-0 z-50 transition-all duration-500 ${
                scrolled
                    ? 'bg-white/95 backdrop-blur-xl shadow-2xl border-b border-orange-100/50'
                    : 'bg-white shadow-lg'
            }`}
            style={{ fontFamily: 'Inter, sans-serif', letterSpacing: 0.1 }}
        >
            {/* Animated Gradient Bar */}
            <motion.div 
                className="h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-red-500 opacity-90"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
            />

            <div className="w-full px-5">
                <div className="flex items-center justify-between h-20 gap-2">
                    {/* Logo & Brand */}
                    <Link to="/" className="flex items-center gap-3 group flex-shrink-0" style={{marginLeft: 0}} aria-label="Home">
                        <motion.div
                            whileHover={{ scale: 1.08, rotate: 2 }}
                            whileTap={{ scale: 0.97 }}
                            className="relative"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
                            <img
                                src={logo}
                                alt="KarigarConnect Logo"
                                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-orange-300 shadow-xl"
                                style={{ background: '#fff' }}
                            />
                        </motion.div>
                        <div className="flex flex-col justify-center">
                            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-orange-600 via-amber-600 to-red-600 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
                                KarigarConnect
                            </span>
                            <span className="hidden sm:block text-xs font-medium text-gray-400 tracking-wide mt-0.5 pl-0.5">
                                India’s Trusted Platform
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Navigation - Hidden on Mobile */}
                    <div className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-3 flex-wrap" data-guide-id="worker-navbar-area" data-guide-id-client="client-navbar-area">
                        {/* Home with Active Indicator */}
                        <Link to="/" className={navLinkClass('/')} data-guide-id="worker-navbar-home" data-guide-id-client="client-navbar-home">
                            <motion.span
                                initial={false}
                                animate={{ scaleX: isActive('/') ? 1 : 0 }}
                                className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full origin-left"
                            />
                            <div className="flex items-center gap-1">
                                <Home size={16} className={isActive('/') ? 'text-orange-500' : ''} />
                                <span>Home</span>
                            </div>
                        </Link>

                        {!isLoggedIn && (
                            <Link to="/faq" className={navLinkClass('/faq')}>
                                <motion.span
                                    initial={false}
                                    animate={{ scaleX: isActive('/faq') ? 1 : 0 }}
                                    className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full origin-left"
                                />
                                <div className="flex items-center gap-1">
                                    <HelpCircle size={16} className={isActive('/faq') ? 'text-orange-500' : ''} />
                                    <span>FAQ</span>
                                </div>
                            </Link>
                        )}

                        {!isLoggedIn && (
                            <>
                                {/* About Us Link - Only for non-logged in users */}
                                <a href="/#about-us" className={navLinkClass('')}>
                                    <span>About Us</span>
                                </a>

                                {/* Contact Link - Only for non-logged in users */}
                                <a href="/#contact" className={navLinkClass('')}>
                                    <span>Contact</span>
                                </a>
                            </>
                        )}

                        {isLoggedIn ? (
                            <>
                                {/* Dashboard */}
                                <Link to={dashboardLink} className={navLinkClass(dashboardLink)} data-guide-id="worker-navbar-dashboard" data-guide-id-client="client-navbar-dashboard">
                                    <motion.span
                                        initial={false}
                                        animate={{ scaleX: isActive(dashboardLink) ? 1 : 0 }}
                                        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full origin-left"
                                    />
                                    <div className="flex items-center gap-1">
                                        <LayoutDashboard size={16} className={isActive(dashboardLink) ? 'text-orange-500' : ''} />
                                        <span>Dashboard</span>
                                    </div>
                                </Link>

                                {/* Enhanced Worker Availability Toggle */}
                                {currentRole === 'worker' && (
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="relative px-2 lg:px-3 py-1.5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-full border border-gray-200 shadow-sm"
                                    >
                                        <div className="flex items-center gap-1.5 lg:gap-2">
                                            <div className="flex items-center gap-1">
                                                <motion.div
                                                    animate={{ scale: isAvailable ? [1, 1.2, 1] : 1 }}
                                                    transition={{ duration: 1, repeat: isAvailable ? Infinity : 0, repeatDelay: 2 }}
                                                    className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-gray-400'}`}
                                                />
                                                <span className="text-[10px] lg:text-xs font-semibold text-gray-700 whitespace-nowrap">
                                                    {isAvailable ? 'Available' : 'Offline'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={toggleAvailability}
                                                className={`relative inline-flex h-5 w-9 lg:h-6 lg:w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                                                    isAvailable ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-300'
                                                }`}
                                            >
                                                <motion.span
                                                    animate={{ x: isAvailable ? 16 : 2 }}
                                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                    className="inline-block h-3.5 w-3.5 lg:h-5 lg:w-5 rounded-full bg-white shadow-md"
                                                />
                                            </button>
                                            <motion.span
                                                animate={{ opacity: isAvailable ? 1 : 0.6 }}
                                                className={`text-[10px] lg:text-xs font-bold ${isAvailable ? 'text-green-600' : 'text-gray-500'}`}
                                            >
                                                {isAvailable ? 'ON' : 'OFF'}
                                            </motion.span>
                                        </div>
                                        
                                        {/* Pulse Effect */}
                                        {isAvailable && (
                                            <motion.div
                                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className="absolute inset-0 rounded-full bg-green-400"
                                                style={{ zIndex: -1 }}
                                            />
                                        )}
                                    </motion.div>
                                )}

                                {/* Enhanced Notification Bell */}
                                {(currentRole === 'worker' || currentRole === 'client' || currentRole === 'admin') && (
                                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                        <NotificationBell role={currentRole} />
                                    </motion.div>
                                )}

                                {/* Language Switcher */}
                                <div data-guide-id="worker-navbar-language" data-guide-id-client="client-navbar-language">
                                    <LanguageSwitcher />
                                </div>

                                {/* Enhanced Profile Dropdown */}
                                <div className="relative profile-menu">
                                    <motion.button
                                        whileHover={{ scale: 1.02, y: -1 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-2.5 py-1.5 rounded-full bg-gradient-to-r from-gray-50 to-white border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-300 group"
                                    >
                                        <div className="relative">
                                            {currentRole === 'admin' ? (
                                                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 border-2 border-orange-300 shadow-sm flex items-center justify-center text-white font-bold text-xs lg:text-sm">
                                                    {user?.name?.charAt(0).toUpperCase() || 'A'}
                                                </div>
                                            ) : (
                                                <img
                                                    src={
                                                        isShopOwnerLoggedIn
                                                            ? (getImageUrl(shopData?.shopLogo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(shopData?.shopName || 'S')}&background=f97316&color=fff&bold=true&size=32`)
                                                            : (getImageUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=f97316&color=fff&bold=true&size=32`)
                                                    }
                                                    alt="Profile"
                                                    className="w-7 h-7 lg:w-8 lg:h-8 rounded-full object-cover border-2 border-orange-300 shadow-sm"
                                                />
                                            )}
                                            {isAvailable && currentRole === 'worker' && (
                                                <motion.div
                                                    animate={{ scale: [1, 1.2, 1] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                    className="absolute -bottom-0.5 -right-0.5 w-2 h-2 lg:w-2.5 lg:h-2.5 bg-green-500 rounded-full border border-white"
                                                />
                                            )}
                                        </div>
                                        <span className="text-xs lg:text-sm font-bold text-gray-700 hidden lg:block">
                                            {isShopOwnerLoggedIn 
                                                ? (shopData?.shopName?.split(' ')[0] || 'Shop') 
                                                : (user?.name?.split(' ')[0] || 'User')}
                                        </span>
                                        <motion.div
                                            animate={{ rotate: dropdownOpen ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <ChevronDown size={12} className="text-gray-500" />
                                        </motion.div>
                                    </motion.button>

                                    <AnimatePresence>
                                        {dropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 overflow-hidden"
                                            >
                                                {/* Profile Header */}
                                                <div className="relative px-5 py-4 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                                                    <div className="flex items-center gap-3">
                                                        {currentRole === 'admin' ? (
                                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 border-3 border-orange-300 shadow-md flex items-center justify-center text-white font-bold text-lg">
                                                                {user?.name?.charAt(0).toUpperCase() || 'A'}
                                                            </div>
                                                        ) : (
                                                            <img
                                                                src={
                                                                    isShopOwnerLoggedIn
                                                                        ? (getImageUrl(shopData?.shopLogo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(shopData?.shopName || 'S')}&background=f97316&color=fff&bold=true&size=48`)
                                                                        : (getImageUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=f97316&color=fff&bold=true&size=48`)
                                                                }
                                                                alt="Profile"
                                                                className="w-12 h-12 rounded-full object-cover border-3 border-orange-300 shadow-md"
                                                            />
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="text-base font-bold text-gray-900">
                                                                {isShopOwnerLoggedIn ? shopData?.shopName : user?.name}
                                                            </p>
                                                            {isShopOwnerLoggedIn ? (
                                                                <>
                                                                    <p className="text-xs text-orange-600 font-medium mt-0.5">
                                                                        {shopData?.category || 'Shop Owner'}
                                                                    </p>
                                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                                        Status: <span className="capitalize font-semibold text-green-600">{shopData?.verificationStatus}</span>
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-xs text-orange-600 font-medium mt-0.5">
                                                                        {currentRole === 'worker' ? `ID: ${user?.karigarId}` : currentRole === 'admin' ? 'Administrator' : 'Premium Client'}
                                                                    </p>
                                                                    {currentRole === 'worker' && (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <div className="flex items-center gap-0.5">
                                                                                <Star size={10} className="text-yellow-500 fill-yellow-500" />
                                                                                <span className="text-[10px] text-gray-500">{workerRating} ★</span>
                                                                            </div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                                                                            <div className="flex items-center gap-0.5">
                                                                                <Award size={10} className="text-orange-500" />
                                                                                <span className="text-[10px] text-gray-500">Verified</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                        {currentRole === 'client' && !isShopOwnerLoggedIn && currentRole !== 'admin' && (
                                                            <Crown size={20} className="text-yellow-500" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Menu Items */}
                                                {isShopOwnerLoggedIn && (
                                                    <>
                                
                                                        <MenuItem 
                                                            icon={Settings} 
                                                            title="Settings" 
                                                            subtitle="Account preferences"
                                                            to="/shop/dashboard"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-purple-500"
                                                            bgColor="bg-purple-50"
                                                        />
                                                    </>
                                                )}
                                                {currentRole === 'worker' && (
                                                    <>
                                                        <MenuItem 
                                                            icon={User} 
                                                            title="View Profile" 
                                                            subtitle="Manage your details"
                                                            to="/worker/profile"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-orange-500"
                                                            bgColor="bg-orange-50"
                                                        />
                                                        <MenuItem 
                                                            icon={CreditCard} 
                                                            title="ID Card" 
                                                            subtitle="Download digital ID"
                                                            to="/worker/id-card"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-blue-500"
                                                            bgColor="bg-blue-50"
                                                        />
                                                        
                                                        <MenuItem 
                                                            icon={Settings} 
                                                            title="Settings" 
                                                            subtitle="Account preferences"
                                                            to="/worker/settings"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-purple-500"
                                                            bgColor="bg-purple-50"
                                                        />
                                                    </>
                                                )}

                                                {currentRole === 'client' && !isShopOwnerLoggedIn && (
                                                    <>
                                                        <MenuItem 
                                                            icon={Settings} 
                                                            title="Settings" 
                                                            subtitle="Account preferences"
                                                            to="/client/settings"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-purple-500"
                                                            bgColor="bg-purple-50"
                                                        />
                                                        <MenuItem 
                                                            icon={User} 
                                                            title="My Profile" 
                                                            subtitle="View and edit profile"
                                                            to="/client/profile"
                                                            onClick={() => setDropdownOpen(false)}
                                                            iconColor="text-amber-500"
                                                            bgColor="bg-amber-50"
                                                        />
                                                    </>
                                                )}

                                                {/* Logout Button */}
                                                <div className="border-t border-gray-100 mt-2 pt-2">
                                                    <MenuItem 
                                                        icon={LogOut} 
                                                        title="Logout" 
                                                        subtitle="Sign out of account"
                                                        onClick={handleLogout}
                                                        iconColor="text-red-500"
                                                        bgColor="bg-red-50"
                                                        isLogout
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        ) : (
                            <>
                                <div data-guide-id="worker-navbar-language" data-guide-id-client="client-navbar-language">
                                    <LanguageSwitcher />
                                </div>
                                
                                <Link
                                    to="/login"
                                    className="px-4 lg:px-5 py-2 text-sm font-semibold text-gray-700 hover:text-orange-600 transition-colors whitespace-nowrap"
                                >
                                    Login
                                </Link>
                                
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <Link
                                        to="/register"
                                        className="px-4 lg:px-6 py-2 lg:py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 rounded-full transition-all duration-300 shadow-lg hover:shadow-xl whitespace-nowrap"
                                    >
                                        Get Started
                                    </Link>
                                </motion.div>
                            </>
                        )}
                    </div>

                    {/* Mobile Controls - Only visible on mobile/tablet */}
                    <div className="flex md:hidden items-center gap-1.5 sm:gap-2" data-guide-id="worker-navbar-area-mobile" data-guide-id-client="client-navbar-area-mobile">
                        {isLoggedIn && (currentRole === 'worker' || currentRole === 'client' || currentRole === 'admin') && (
                            <NotificationBell role={currentRole} />
                        )}
                        <div data-guide-id="worker-navbar-language" data-guide-id-client="client-navbar-language">
                            <LanguageSwitcher />
                        </div>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="p-2 rounded-xl hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-300"
                        >
                            {mobileMenuOpen ? <X size={20} className="text-orange-500" /> : <Menu size={20} />}
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu - Optimized for touch */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden bg-white border-t border-gray-100 shadow-xl overflow-hidden max-h-[80vh] overflow-y-auto"
                    >
                        <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
                            <MobileMenuItem 
                                icon={Home} 
                                title="Home" 
                                to="/" 
                                onClick={() => setMobileMenuOpen(false)} 
                            />

                            {!isLoggedIn && (
                                <MobileMenuItem 
                                    icon={HelpCircle} 
                                    title="FAQ" 
                                    to="/faq" 
                                    onClick={() => setMobileMenuOpen(false)} 
                                />
                            )}

                            {!isLoggedIn && (
                                <>
                                    <a 
                                        href="/#about-us"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all group min-h-[48px]"
                                    >
                                        <div className="text-orange-500">ℹ️</div>
                                        <span className="font-medium text-base">About Us</span>
                                    </a>
                                    
                                    <a 
                                        href="/#contact"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all group min-h-[48px]"
                                    >
                                        <div className="text-orange-500">📞</div>
                                        <span className="font-medium text-base">Contact</span>
                                    </a>
                                </>
                            )}

                            {isLoggedIn ? (
                                <>
                                    <MobileMenuItem 
                                        icon={LayoutDashboard} 
                                        title="Dashboard" 
                                        to={dashboardLink} 
                                        onClick={() => setMobileMenuOpen(false)} 
                                    />

                                    {currentRole === 'worker' && (
                                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2.5 h-2.5 rounded-full ${isAvailable ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                                <span className="text-sm font-semibold text-gray-700">Availability</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                                    {isAvailable ? 'Available' : 'Offline'}
                                                </span>
                                            </div>
                                            <button
                                                onClick={toggleAvailability}
                                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${
                                                    isAvailable ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gray-300'
                                                }`}
                                            >
                                                <motion.span
                                                    animate={{ x: isAvailable ? 26 : 2 }}
                                                    className="inline-block h-5 w-5 rounded-full bg-white shadow-md"
                                                />
                                            </button>
                                        </div>
                                    )}

                                    <div className="border-t border-gray-100 pt-3 mt-2">
                                        <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl mb-2">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={
                                                        isShopOwnerLoggedIn
                                                            ? (getImageUrl(shopData?.shopLogo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(shopData?.shopName || 'S')}&background=f97316&color=fff&bold=true`)
                                                            : (getImageUrl(user?.photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=f97316&color=fff&bold=true`)
                                                    }
                                                    alt="Profile"
                                                    className="w-10 h-10 rounded-full object-cover border-2 border-orange-300"
                                                />
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">
                                                        {isShopOwnerLoggedIn ? shopData?.shopName : user?.name}
                                                    </p>
                                                    <p className="text-xs text-orange-600 mt-0.5">
                                                        {isShopOwnerLoggedIn 
                                                            ? (shopData?.category || 'Shop Owner')
                                                            : (currentRole === 'worker' ? user?.karigarId : 'Client Account')
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {isShopOwnerLoggedIn && (
                                            <>
                                                <MobileMenuItem 
                                                    icon={User} 
                                                    title="View Profile" 
                                                    to="/shop/profile" 
                                                    onClick={() => setMobileMenuOpen(false)} 
                                                />
                                                <MobileMenuItem 
                                                    icon={Settings} 
                                                    title="Dashboard Settings" 
                                                    to="/shop/dashboard" 
                                                    onClick={() => setMobileMenuOpen(false)} 
                                                />
                                            </>
                                        )}
                                        {currentRole === 'worker' && (
                                            <>
                                                <MobileMenuItem 
                                                    icon={User} 
                                                    title="View Profile" 
                                                    to="/worker/profile" 
                                                    onClick={() => setMobileMenuOpen(false)} 
                                                />
                                                <MobileMenuItem 
                                                    icon={CreditCard} 
                                                    title="ID Card" 
                                                    to="/worker/id-card" 
                                                    onClick={() => setMobileMenuOpen(false)} 
                                                />
                                                <MobileMenuItem 
                                                    icon={Settings} 
                                                    title="Settings" 
                                                    to="/worker/settings" 
                                                    onClick={() => setMobileMenuOpen(false)} 
                                                />
                                            </>
                                        )}

                                        {currentRole === 'client' && !isShopOwnerLoggedIn && (
                                            <MobileMenuItem 
                                                icon={Settings} 
                                                title="Settings" 
                                                to="/client/settings" 
                                                onClick={() => setMobileMenuOpen(false)} 
                                            />
                                        )}

                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all mt-2"
                                        >
                                            <LogOut size={18} className="text-red-500" />
                                            <span className="font-medium">Logout</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-4 py-3 text-center text-gray-700 font-semibold hover:bg-orange-50 rounded-xl transition-all"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="block px-4 py-3 text-center text-white bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 rounded-xl transition-all font-bold"
                                    >
                                        Get Started Free
                                    </Link>
                                </>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

// Helper Components
const MenuItem = ({ icon: Icon, title, subtitle, to, onClick, iconColor, bgColor, isLogout }) => {
    const content = (
        <div className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 transition-all duration-200 group cursor-pointer">
            <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon size={16} className={iconColor} />
            </div>
            <div className="flex-1">
                <p className={`font-medium ${isLogout ? 'text-red-600' : 'text-gray-700'}`}>{title}</p>
                {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
            {!isLogout && (
                <motion.div
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    →
                </motion.div>
            )}
        </div>
    );

    if (to) {
        return <Link to={to} onClick={onClick}>{content}</Link>;
    }
    return <div onClick={onClick}>{content}</div>;
};

const MobileMenuItem = ({ icon: Icon, title, to, onClick }) => (
    <Link
        to={to}
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-amber-50 rounded-xl transition-all group min-h-[48px]"
    >
        <Icon size={18} className="text-orange-500 group-hover:scale-110 transition-transform" />
        <span className="font-medium text-base">{title}</span>
    </Link>
);

export default Header;