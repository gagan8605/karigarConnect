// src/components/admin/AdminSidebar.jsx
// PREMIUM VERSION - Modern design with gradients, animations, and enhanced UX
// Desktop: fixed left sidebar, scrollable
// Mobile: hidden sidebar + bottom navigation bar

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, UserCheck, UserX, Clock, ShieldX,
    AlertTriangle, MessageSquare, Store, X as CloseIcon,
    ShieldAlert, BarChart3, Briefcase, UserRound, Trophy,
    LayoutDashboard, ShoppingBag, Award, Star, TrendingUp,
    Crown, Diamond, Sparkles, Zap, Gift, Heart, ThumbsUp,
    PhoneCall, Wrench, Calendar, FileText, Home, Settings,
    HelpCircle, LogOut, Menu, Bell, Search, Filter
} from 'lucide-react';

const NAV_SECTIONS = [
    {
        label: 'Overview',
        icon: LayoutDashboard,
        items: [
            { path: '/admin/dashboard', label: 'Dashboard', icon: BarChart3, isFilter: false, isSection: true, section: 'dashboard', color: 'from-orange-500 to-amber-500' },
        ]
    },
    {
        label: 'Directory',
        icon: Users,
        items: [
            { path: '/admin/users', label: 'User Management', icon: UserRound, isFilter: false, isSection: true, section: 'users', color: 'from-blue-500 to-cyan-500' },
            { path: '/admin/marketplace', label: 'Marketplace', icon: Store, isFilter: false, isSection: true, section: 'marketplace', color: 'from-emerald-500 to-teal-500' },
            { path: '/admin/leaderboard', label: 'Worker Leaderboard', icon: Trophy, isFilter: false, isSection: true, section: 'leaderboard', color: 'from-yellow-500 to-amber-500' },
        ]
    },
    {
        label: 'Workers',
        icon: UserCheck,
        items: [
            { filter: 'pending',  label: 'Pending Review', icon: Clock, isFilter: true, color: 'from-amber-500 to-orange-500' },
            { filter: 'approved', label: 'Approved', icon: UserCheck, isFilter: true, color: 'from-emerald-500 to-green-500' },
            { filter: 'rejected', label: 'Rejected', icon: UserX, isFilter: true, color: 'from-red-500 to-rose-500' },
            { filter: 'blocked',  label: 'Blocked', icon: ShieldX, isFilter: true, color: 'from-gray-500 to-gray-600' },
        ]
    },
    {
        label: 'Clients',
        icon: Users,
        items: [
            { filter: 'clients', label: 'All Clients', icon: Users, isFilter: true, color: 'from-purple-500 to-pink-500' },
        ]
    },
    {
        label: 'Monitoring',
        icon: ShieldAlert,
        items: [
            { path: '/admin/fraud', label: 'Fraud Monitor', icon: ShieldAlert, isFilter: false, isSection: true, section: 'fraud', color: 'from-red-500 to-rose-500' },
            { path: '/admin/chatbot-support', label: 'Chatbot Support', icon: MessageSquare, isFilter: false, isSection: true, section: 'chatbot-support', color: 'from-orange-500 to-amber-500' },
            { path: '/admin/direct-hires', label: 'Payment Section', icon: Briefcase, isFilter: false, isSection: true, section: 'direct-hires', color: 'from-cyan-500 to-blue-500' },
        ]
    },
    {
        label: 'Complaints',
        icon: AlertTriangle,
        items: [
            { path: '/admin/complaints', label: 'Client Complaints', icon: AlertTriangle, isFilter: false, isSection: true, section: 'complaints', color: 'from-orange-500 to-red-500' },
            { path: '/admin/worker-complaints', label: 'Worker Complaints', icon: MessageSquare, isFilter: false, isSection: true, section: 'worker-complaints', color: 'from-purple-500 to-pink-500' },
        ]
    },
    {
        label: 'Community',
        icon: MessageSquare,
        items: [
            { path: '/admin/community', label: 'Manage Posts', icon: MessageSquare, isFilter: false, isSection: true, section: 'community', color: 'from-indigo-500 to-purple-500' },
        ]
    },
    {
        label: 'Shop Management',
        icon: Store,
        items: [
            { path: '/admin/shops', label: 'Shops & Coupons', icon: Store, isFilter: false, isSection: true, section: 'shops', color: 'from-teal-500 to-emerald-500' },
        ]
    },
];

// Bottom nav — 5 slots covering all page-level routes + most critical filter
const BOTTOM_NAV_ITEMS = [
    { filter: 'pending', label: 'Pending', icon: Clock, isFilter: true, color: 'from-amber-500 to-orange-500' },
    { path: '/admin/fraud', label: 'Fraud', icon: ShieldAlert, isFilter: false, isSection: true, section: 'fraud', color: 'from-red-500 to-rose-500' },
    { path: '/admin/complaints', label: 'Client', icon: AlertTriangle, isFilter: false, isSection: true, section: 'complaints', color: 'from-orange-500 to-red-500' },
    { path: '/admin/worker-complaints', label: 'Worker', icon: MessageSquare, isFilter: false, isSection: true, section: 'worker-complaints', color: 'from-purple-500 to-pink-500' },
    { path: '/admin/community', label: 'Community', icon: MessageSquare, isFilter: false, isSection: true, section: 'community', color: 'from-indigo-500 to-purple-500' },
    { path: '/admin/shops', label: 'Shops', icon: Store, isFilter: false, isSection: true, section: 'shops', color: 'from-teal-500 to-emerald-500' },
];

const AdminSidebar = ({
    isOpen,
    onClose,
    activeFilter,
    onFilterChange,
    currentSection,
    onSectionChange,
    stats = {},
    dashboardStats = {},
    chatbotSupportCount = 0,
    onViewModeChange = () => {},
}) => {
    const handleNav = (item) => {
        if (item.isFilter) {
            onFilterChange(item.filter);
            if (currentSection !== 'dashboard') {
                onSectionChange('dashboard');
            }
            onViewModeChange('records');
        } else if (item.isSection) {
            onSectionChange(item.section || 'dashboard');
            onViewModeChange('stats');
        } else {
            const sectionMap = {
                '/admin/fraud': 'fraud',
                '/admin/complaints': 'complaints',
                '/admin/worker-complaints': 'worker-complaints',
                '/admin/community': 'community',
                '/admin/shops': 'shops',
                '/admin/users': 'users',
                '/admin/marketplace': 'marketplace',
                '/admin/leaderboard': 'leaderboard',
                '/admin/direct-hires': 'direct-hires',
                '/admin/chatbot-support': 'chatbot-support',
            };
            onSectionChange(sectionMap[item.path] || 'dashboard');
            onViewModeChange('stats');
        }
        onClose();
    };

    const isActive = (item) => {
        if (item.isFilter) return activeFilter === item.filter;
        if (item.isSection) return currentSection === (item.section || 'dashboard');
        const sectionMap = {
            '/admin/fraud': 'fraud',
            '/admin/complaints': 'complaints',
            '/admin/worker-complaints': 'worker-complaints',
            '/admin/community': 'community',
            '/admin/shops': 'shops',
            '/admin/direct-hires': 'direct-hires',
            '/admin/users': 'users',
            '/admin/marketplace': 'marketplace',
            '/admin/leaderboard': 'leaderboard',
            '/admin/chatbot-support': 'chatbot-support',
        };
        return currentSection === (sectionMap[item.path] || 'dashboard');
    };

    const getCount = (filter) => {
        const map = {
            pending:  stats.pending,
            approved: stats.approved,
            rejected: stats.rejected,
            blocked:  stats.blocked,
            clients:  stats.totalClients,
        };
        return map[filter];
    };

    return (
        <>
            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar Drawer */}
            <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: isOpen ? 0 : '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="lg:hidden fixed top-16 left-0 h-[calc(100vh-4rem)] w-80 bg-gradient-to-br from-orange-50 via-white to-orange-50 z-50 shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-orange-100 bg-gradient-to-r from-orange-500 to-amber-500">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                <ShieldAlert size="16" className="text-white" />
                            </div>
                            <span className="text-white font-bold text-sm">Admin Panel</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                        >
                            <CloseIcon size="16" className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Scrollable nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 pb-24">
                    {NAV_SECTIONS.map((section, idx) => (
                        <div key={section.label}>
                            <div className="flex items-center gap-1.5 px-3 mb-2">
                                <section.icon size="10" className="text-orange-500" />
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    {section.label}
                                </p>
                            </div>
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item);
                                    const count = item.isFilter
                                        ? getCount(item.filter)
                                        : item.path === '/admin/chatbot-support'
                                            ? chatbotSupportCount
                                            : undefined;
                                    const gradientColor = item.color || 'from-orange-500 to-amber-500';
                                    
                                    return (
                                        <motion.button
                                            key={item.filter || item.path}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleNav(item)}
                                            className={`flex items-center w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                                                active 
                                                    ? `bg-gradient-to-r ${gradientColor} text-white shadow-md` 
                                                    : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                            }`}
                                        >
                                            <Icon size="16" className={`mr-3 shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'}`} />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {count !== undefined && count > 0 && (
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[22px] text-center ${
                                                    active 
                                                        ? 'bg-white/20 text-white' 
                                                        : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                    {count}
                                                </span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50">
                    <p className="text-[9px] text-gray-400 text-center">KarigarConnect Admin v2.0</p>
                </div>
            </motion.aside>

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-gradient-to-br from-orange-50 via-white to-orange-50 border-r border-orange-100 h-[calc(100vh-64px)] sticky top-16 shadow-lg overflow-hidden">
                {/* Header */}

                {/* Scrollable nav */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar">
                    {NAV_SECTIONS.map((section) => (
                        <div key={section.label}>
                            <div className="flex items-center gap-2 px-3 mb-2">
                                <section.icon size="12" className="text-orange-500" />
                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                                    {section.label}
                                </p>
                            </div>
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item);
                                    const count = item.isFilter
                                        ? getCount(item.filter)
                                        : item.path === '/admin/chatbot-support'
                                            ? chatbotSupportCount
                                            : undefined;
                                    const gradientColor = item.color || 'from-orange-500 to-amber-500';
                                    
                                    return (
                                        <motion.button
                                            key={item.filter || item.path}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => handleNav(item)}
                                            className={`flex items-center w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group ${
                                                active 
                                                    ? `bg-gradient-to-r ${gradientColor} text-white shadow-md shadow-orange-200` 
                                                    : 'text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                                            }`}
                                        >
                                            <Icon size="18" className={`mr-3 shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-orange-500'}`} />
                                            <span className="flex-1 text-left">{item.label}</span>
                                            {count !== undefined && count > 0 && (
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center ${
                                                    active 
                                                        ? 'bg-white/25 text-white' 
                                                        : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                    {count}
                                                </span>
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="px-4 py-4 border-t border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        <p className="text-[9px] text-gray-500">System Online</p>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <p className="text-[9px] text-gray-500">All Systems Operational</p>
                    </div>
                    <p className="text-[9px] text-gray-400 text-center">KarigarConnect Admin Panel v2.0</p>
                </div>
            </aside>

            {/* Mobile Bottom Navigation Bar */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-orange-100 shadow-[0_-4px_20px_rgba(234,88,12,0.08)] safe-area-inset-bottom">
                <div className="flex items-center justify-around px-2 py-2">
                    {BOTTOM_NAV_ITEMS.slice(0, 5).map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item);
                        const count = item.isFilter ? getCount(item.filter) : undefined;
                        const gradientColor = item.color || 'from-orange-500 to-amber-500';
                        
                        return (
                            <motion.button
                                key={item.filter || item.path}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                    if (item.isFilter) {
                                        onFilterChange(item.filter);
                                        if (currentSection !== 'dashboard') {
                                            onSectionChange('dashboard');
                                        }
                                        onViewModeChange('records');
                                    } else {
                                        handleNav(item);
                                    }
                                }}
                                className={`flex flex-col items-center justify-center px-3 py-2 rounded-xl flex-1 relative transition-all duration-200 ${
                                    active ? 'text-orange-600' : 'text-gray-400'
                                }`}
                            >
                                {/* Active pill */}
                                {active && (
                                    <motion.div
                                        layoutId="activeNav"
                                        className="absolute inset-0 bg-gradient-to-r rounded-xl opacity-10"
                                        style={{ background: `linear-gradient(135deg, ${gradientColor.split(' ')[1] || '#f97316'}, ${gradientColor.split(' ')[2] || '#f59e0b'})` }}
                                    />
                                )}

                                {/* Badge */}
                                {count !== undefined && count > 0 && (
                                    <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-1 right-2 min-w-[16px] h-4 px-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center z-10 shadow-sm"
                                    >
                                        {count > 99 ? '99+' : count}
                                    </motion.span>
                                )}

                                <Icon size="18" className={`relative z-10 transition-transform duration-200 ${active ? 'scale-110' : ''}`} />
                                <span className={`relative z-10 text-[9px] mt-0.5 font-semibold leading-none ${active ? 'text-orange-600' : 'text-gray-500'}`}>
                                    {item.label}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>
            </nav>

            {/* Custom Scrollbar Styles */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #fef3c7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #f97316;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #ea580c;
                }
                .safe-area-inset-bottom {
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                }
            `}</style>
        </>
    );
};

export default AdminSidebar;