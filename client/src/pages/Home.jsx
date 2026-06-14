import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, HelpCircle, MessageSquareQuote, Sparkles, 
  Users, Briefcase, Store, Star, ChevronRight, Play, 
  Phone, Mail, MapPin, Facebook, Instagram, Twitter, 
    Linkedin, Youtube, Award, TrendingUp, Shield, Clock, X,
  Zap, Gift, Heart, ThumbsUp, CheckCircle, Crown, Diamond
} from 'lucide-react';
import logo from '../assets/logo.jpg';
import faqData from '../constants/faqData';
import FaqAccordion from '../components/FaqAccordion';
import GuestChatbotWidget from '../components/GuestChatbotWidget';
import CityTicker from '../components/CityTicker';
import { getSiteVisitorCount, recordSiteVisitor } from '../api';

const Home = () => {
    const [token, setToken] = useState(null);
    const [role, setRole] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [activeTestimonial, setActiveTestimonial] = useState(0);
    const [cookieChoice, setCookieChoice] = useState('unknown');
    const [legalPreview, setLegalPreview] = useState({ open: false, title: '', path: '' });
    const [visitorCount, setVisitorCount] = useState(null);
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

    useEffect(() => {
        const authToken = localStorage.getItem('token');
        const authRole = localStorage.getItem('role');
        const shopToken = localStorage.getItem('shopToken');
        const shopRole = localStorage.getItem('shopRole');
        const storedCookieChoice = localStorage.getItem('kc_cookie_consent_v1');
        
        if (shopToken && shopRole) {
            setToken(shopToken);
            setRole('shop');
        } else if (authToken && authRole) {
            setToken(authToken);
            setRole(authRole);
        }

        if (storedCookieChoice === 'accepted' || storedCookieChoice === 'declined') {
            setCookieChoice(storedCookieChoice);
        }

        let cancelled = false;

        const safeParse = (value) => {
            try {
                return JSON.parse(value || '{}');
            } catch {
                return {};
            }
        };

        const getVisitorIdentity = () => {
            const shopToken = localStorage.getItem('shopToken');
            const shopRole = localStorage.getItem('shopRole');
            const roleValue = shopToken && shopRole ? 'shop' : (localStorage.getItem('role') || 'guest');
            const user = safeParse(localStorage.getItem('user'));
            const shop = safeParse(localStorage.getItem('shop'));

            const accountId = roleValue === 'shop'
                ? (shop?._id || shop?.id || shop?.shopId || shop?.mobile || shop?.ownerMobile)
                : (user?._id || user?.id || user?.clientId || user?.mobile);

            if (accountId) {
                return `account:${roleValue}:${accountId}`;
            }

            const visitorIdKey = 'kc_unique_visitor_id_v1';
            let anonymousVisitorId = localStorage.getItem(visitorIdKey);
            if (!anonymousVisitorId) {
                anonymousVisitorId = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `visitor-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                localStorage.setItem(visitorIdKey, anonymousVisitorId);
            }

            return `browser:${anonymousVisitorId}`;
        };

        const loadVisitorCount = async () => {
            try {
                const { data } = await getSiteVisitorCount();
                if (!cancelled) setVisitorCount(Number(data?.totalVisitors) || 0);
            } catch {
                if (!cancelled) setVisitorCount((current) => (current === null ? 0 : current));
            }
        };

        const syncUniqueVisitor = async () => {
            const visitorId = getVisitorIdentity();
            const recordedKey = `kc_unique_visitor_recorded_v1:${visitorId}`;

            try {
                const alreadyRecorded = localStorage.getItem(recordedKey) === '1';
                if (alreadyRecorded) {
                    await loadVisitorCount();
                    return;
                }

                const { data } = await recordSiteVisitor({
                    visitorId,
                    landingPath: '/home',
                    referrer: document.referrer || null,
                });

                if (!cancelled) {
                    setVisitorCount(Number(data?.totalVisitors) || 0);
                    localStorage.setItem(recordedKey, '1');
                }
            } catch {
                await loadVisitorCount();
            }
        };

        syncUniqueVisitor();
        
        setTimeout(() => setIsVisible(true), 100);

        return () => {
            cancelled = true;
        };
    }, []);

    const handleCookieChoice = (choice) => {
        localStorage.setItem('kc_cookie_consent_v1', choice);
        setCookieChoice(choice);
    };

    const openLegalPreview = (title, path) => {
        const previewPath = path.includes('?') ? `${path}&embed=1` : `${path}?embed=1`;
        setLegalPreview({ open: true, title, path: previewPath });
    };

    const closeLegalPreview = () => {
        setLegalPreview({ open: false, title: '', path: '' });
    };

    const dashboardLink = role === 'admin' ? '/admin/dashboard' : 
                         role === 'worker' ? '/worker/dashboard' :
                         role === 'shop' ? '/shop/dashboard' :
                         '/client/dashboard';

    const features = [
        { icon: '🔍', title: 'Find Skilled Karigars', description: 'Connect with verified professionals for all your needs', color: 'from-orange-500 to-amber-500' },
        { icon: '💼', title: 'Grow Your Business', description: 'Get more visibility and clients for your services', color: 'from-blue-500 to-cyan-500' },
        { icon: '⭐', title: 'Rate & Review', description: 'Share your experience and help others make decisions', color: 'from-purple-500 to-pink-500' },
        { icon: '💰', title: 'Fair Pricing', description: 'Transparent costs with no hidden charges', color: 'from-emerald-500 to-teal-500' },
    ];

    const testimonials = [
        { name: 'Ramesh Kumar', role: 'Karigar - Plumber', content: 'KarigarConnect changed my life! I now get regular work and fair payments. The platform is easy to use and the support team is great.', rating: 5, location: 'Pune', image: 'https://randomuser.me/api/portraits/men/32.jpg' },
        { name: 'Priya Sharma', role: 'Client - Homeowner', content: 'Found a fantastic electrician through this platform. The verification process gives me confidence. Highly recommended!', rating: 5, location: 'Mumbai', image: 'https://randomuser.me/api/portraits/women/44.jpg' },
        { name: 'Amit Patel', role: 'Shop Owner', content: 'Our business has grown 40% since joining KarigarConnect. The coupon system brings in verified customers daily.', rating: 5, location: 'Ahmedabad', image: 'https://randomuser.me/api/portraits/men/45.jpg' },
    ];

    const faqHighlights = [
        { icon: HelpCircle, title: 'All roles covered', description: 'Questions explain the experience for clients, workers, shop owners, and admins.' },
        { icon: MessageSquareQuote, title: 'Project workflows', description: 'Answers include registration, matching, pricing, support, and live tracking.' },
        { icon: Sparkles, title: 'Fast onboarding', description: 'New users can understand the platform before they start using the dashboard.' },
    ];

    // Indian worker images for background
    const bgImages = [
        'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1600&q=80',
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80',
    ];

    return (
        <div className="min-h-screen pb-10 bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10">
            
            {/* Hero Section with Animated Background */}
            <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
                {/* Dynamic Background Slideshow */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70 z-10" />
                    <img 
                        src={bgImages[0]} 
                        alt="Indian Worker" 
                        className="absolute inset-0 w-full h-full object-cover animate-scale-slow"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent z-10" />
                </div>

                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
                    <motion.div style={{ opacity, scale }}>
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mb-6 border border-white/20"
                        >
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            <span className="text-white text-sm font-medium">India's Largest Professional Network</span>
                        </motion.div>

                        <motion.h1 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight"
                        >
                            Connect with India's
                            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent block mt-2">
                                Finest Karigars
                            </span>
                        </motion.h1>

                        <motion.p 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="mt-6 text-lg text-white/90 max-w-3xl mx-auto"
                        >
                            {token 
                                ? "Your central hub for managing your work and connections." 
                                : "The trusted network connecting skilled workers with local communities across India."
                            }
                        </motion.p>
                        
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="mt-8 flex flex-col sm:flex-row justify-center gap-4"
                        >
                            {token ? (
                                <Link
                                    to={dashboardLink}
                                    className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 inline-flex items-center gap-2"
                                >
                                    Go to Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 inline-flex items-center gap-2"
                                    >
                                        Get Started <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="px-8 py-4 bg-white/10 backdrop-blur-md border-2 border-white/30 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 hover:bg-white/20"
                                    >
                                        Register Now
                                    </Link>
                                </>
                            )}
                        </motion.div>

                        {!token && (
                            <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 20 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="mt-6"
                            >
                                <Link
                                    to="/check-status"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500/20 backdrop-blur-md text-orange-200 font-semibold rounded-xl border border-orange-300/50 hover:bg-orange-500/30 transition-all"
                                >
                                    Know Your Application Status
                                </Link>
                            </motion.div>
                        )}
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20"
                >
                    <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
                        <div className="w-1 h-2 bg-white rounded-full mt-2 animate-scroll" />
                    </div>
                </motion.div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-2 mb-4 shadow-sm"
                        >
                            <Zap className="w-4 h-4 text-orange-600" />
                            <span className="text-orange-600 text-sm font-semibold">Why Choose Us</span>
                        </motion.div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything You Need in One Platform</h2>
                        <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">We make it easy to connect with skilled professionals across India</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((feature, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{ y: -8 }}
                                className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-300 group"
                            >
                                <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform`}>
                                    <span className="text-2xl">{feature.icon}</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="inline-flex items-center gap-2 bg-blue-100 rounded-full px-4 py-2 mb-4"
                        >
                            <Play className="w-4 h-4 text-blue-600" />
                            <span className="text-blue-600 text-sm font-semibold">Simple Process</span>
                        </motion.div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How KarigarConnect Works</h2>
                        <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">Get started in three simple steps</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { step: '01', title: 'Register', description: 'Sign up as a Karigar, Client, or Shop Owner with your details', icon: Users, color: 'from-orange-500 to-amber-500' },
                            { step: '02', title: 'Connect', description: 'Find verified professionals or discover work opportunities', icon: Handshake, color: 'from-blue-500 to-cyan-500' },
                            { step: '03', title: 'Grow', description: 'Complete projects, earn ratings, and build your reputation', icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
                        ].map((item, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: idx * 0.1 }}
                                whileHover={{ y: -8 }}
                                className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 text-center shadow-md hover:shadow-xl transition-all"
                            >
                                <div className={`absolute -top-4 left-1/2 transform -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-r ${item.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}>
                                    {item.step}
                                </div>
                                <div className={`w-16 h-16 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center mx-auto mt-6 mb-4 shadow-md`}>
                                    <item.icon className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                                <p className="text-gray-600">{item.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
           

            {/* FAQ Section */}
            <section id="faq" className="py-20 bg-white relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.08),_transparent_35%)]" />
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start mb-12">
                        <div>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="inline-flex items-center gap-2 bg-orange-100 rounded-full px-4 py-2 mb-4"
                            >
                                <HelpCircle className="w-4 h-4 text-orange-600" />
                                <span className="text-orange-600 text-sm font-semibold">FAQ</span>
                            </motion.div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
                            <p className="mt-4 text-lg text-gray-600 max-w-3xl">
                                Everything you need to know about KarigarConnect platform
                            </p>
                        </div>
                        <div className="rounded-2xl border border-orange-100 bg-white/90 p-6 shadow-xl shadow-orange-100/50">
                            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                {faqHighlights.map((item, idx) => {
                                    const Icon = item.icon;
                                    return (
                                        <motion.div
                                            key={item.title}
                                            initial={{ opacity: 0, x: -20 }}
                                            whileInView={{ opacity: 1, x: 0 }}
                                            viewport={{ once: true }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="rounded-2xl bg-gradient-to-br from-orange-50 to-white p-4"
                                        >
                                            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md">
                                                <Icon size={20} />
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900">{item.title}</h3>
                                            <p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                            <Link to="/faq" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-600 hover:text-orange-700 transition group">
                                Open the full FAQ page <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>

                    <FaqAccordion items={faqData} />
                </div>
            </section>

            {/* IVR Callout for Workers */}
            {role === 'worker' && (
                <section className="py-12 px-4">
                    <div className="max-w-3xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="bg-gradient-to-r from-orange-100 to-orange-200 border-2 border-orange-300 rounded-2xl p-8 shadow-lg"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
                                    <Phone className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-bold text-orange-800 mb-2">IVR Worker Helpline</h3>
                                <a href="tel:+18147403875" className="text-3xl font-extrabold text-orange-600 hover:text-orange-700 transition-colors mb-4">
                                    +1 814-740-3875
                                </a>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-sm text-gray-700 mb-4">
                                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Get availability updates</div>
                                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Know about nearby jobs</div>
                                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Registration guidance</div>
                                    <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Profile summary & status</div>
                                </div>
                                <div className="text-xs text-gray-500">* This number is for workers only</div>
                            </div>
                        </motion.div>
                    </div>
                </section>
            )}

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
                        <p className="text-lg text-orange-100 mb-8 max-w-2xl mx-auto">
                            {token 
                                ? "Manage your account and connections from your personalized dashboard." 
                                : "Join thousands of karigars and clients who are already benefiting from our platform."
                            }
                        </p>
                        {!token && (
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Link
                                    to="/register"
                                    className="px-8 py-4 bg-white text-orange-600 font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                                >
                                    Register Now
                                </Link>
                                <Link
                                    to="/login"
                                    className="px-8 py-4 bg-orange-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
                                >
                                    Login
                                </Link>
                            </div>
                        )}
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gradient-to-b from-gray-900 to-gray-950 text-white py-16 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Top Section with Logo and Description */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12 pb-12 border-b border-gray-700">
                        {/* Logo and Brand Section */}
                        <div>
                            <Link to="/" className="flex items-center gap-3 mb-4 group">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-500 rounded-full blur-md opacity-40 group-hover:opacity-80 transition-opacity" />
                                    <img src={logo} alt="KarigarConnect Logo" className="relative w-12 h-12 rounded-full object-cover border-2 border-orange-300" />
                                </div>
                                <span className="text-lg sm:text-xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                                    KarigarConnect™
                                </span>
                            </Link>
                            <p className="text-gray-400 text-sm leading-relaxed mt-4">
                                Transforming the services industry by seamlessly connecting skilled professionals with customers across India.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110">
                                    <Facebook className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110">
                                    <Instagram className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110">
                                    <Twitter className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110">
                                    <Linkedin className="w-5 h-5" />
                                </a>
                                <a href="#" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-orange-500 transition-all transform hover:scale-110">
                                    <Youtube className="w-5 h-5" />
                                </a>
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Quick Links</h3>
                            <ul className="space-y-3">
                                <li><a href="#about-us" className="text-gray-400 hover:text-orange-400 transition-colors">About Us</a></li>
                                <li><a href="#contact" className="text-gray-400 hover:text-orange-400 transition-colors">Contact Us</a></li>
                                <li><Link to="/" className="text-gray-400 hover:text-orange-400 transition-colors">Home</Link></li>
                                <li><a href="#" className="text-gray-400 hover:text-orange-400 transition-colors">Find Workers</a></li>
                                <li><Link to="/faq" className="text-gray-400 hover:text-orange-400 transition-colors">FAQ</Link></li>
                            </ul>
                        </div>

                        {/* Company */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Company</h3>
                            <ul className="space-y-3">
                                <li><button type="button" onClick={() => openLegalPreview('Terms & Conditions', '/terms-and-conditions')} className="text-gray-400 hover:text-orange-400 transition-colors">Terms & Conditions</button></li>
                                <li><button type="button" onClick={() => openLegalPreview('Privacy Policy', '/privacy-policy')} className="text-gray-400 hover:text-orange-400 transition-colors">Privacy Policy</button></li>
                            </ul>
                        </div>

                        {/* Contact Information */}
                        <div>
                            <h3 className="text-lg font-bold mb-6 text-white">Contact Info</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <Phone className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-gray-300 text-sm font-semibold">Phone</p>
                                        <a href="tel:+918605171209" className="text-gray-400 hover:text-orange-400 transition-colors">+91 8605171209</a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-gray-300 text-sm font-semibold">Email</p>
                                        <a href="mailto:kc.india07@gmail.com" className="text-gray-400 hover:text-orange-400 transition-colors break-all">kc.india07@gmail.com</a>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Address Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 pb-12 border-b border-gray-700">
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-orange-400" />
                                Corporate Address
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                                Manjari Budruk<br />
                                Hadapsar Road, Manjri<br />
                                Wagholi, Maharashtra 412307<br />
                                <span className="text-sm text-gray-400">India</span>
                            </p>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-orange-400" />
                                Registered Address
                            </h3>
                            <p className="text-gray-300 leading-relaxed">
                                Manjari Budruk<br />
                                Hadapsar Road, Manjri<br />
                                Wagholi, Maharashtra 412307<br />
                                <span className="text-sm text-gray-400">India</span>
                            </p>
                        </div>
                    </div>

                    {/* Bottom Section - Copyright */}
                    <div className="text-center">
                        <p className="text-gray-400 text-sm">
                            &copy; {new Date().getFullYear()} KarigarConnect™. All rights reserved. | One nation, One labour chowk
                        </p>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-white/5 px-4 py-2 text-xs sm:text-sm text-gray-300">
                            <Shield className="w-4 h-4 text-orange-400" />
                            <span>Unique visitors:</span>
                            <span className="font-bold text-white">
                                {visitorCount === null ? 'Loading...' : visitorCount.toLocaleString()}
                            </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-4">
                            Designed & Developed with <span className="text-orange-400">❤</span> in India
                        </p>
                    </div>
                </div>
            </footer>

            {cookieChoice === 'unknown' && (
                <div className="fixed bottom-0 inset-x-0 z-50 px-4 pb-4">
                    <div className="max-w-4xl mx-auto rounded-2xl border border-orange-200 bg-white/95 backdrop-blur shadow-2xl p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Cookie Preferences</p>
                                <p className="text-xs text-gray-600 mt-1">We use cookies to improve your experience and keep the platform secure. You can accept or decline non-essential cookies.</p>
                            </div>
                            <div className="flex items-center gap-2 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleCookieChoice('declined')}
                                    className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100"
                                >
                                    Decline
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCookieChoice('accepted')}
                                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-semibold hover:from-orange-600 hover:to-amber-600"
                                >
                                    Accept
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            {!token && <GuestChatbotWidget />}
            <CityTicker />

            <style>{`
                @keyframes scale-slow {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                .animate-scale-slow {
                    animation: scale-slow 20s ease-in-out infinite;
                }
                @keyframes scroll {
                    0% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(8px); }
                }
                .animate-scroll {
                    animation: scroll 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

// Helper component for Handshake
const Handshake = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4-4 4M7 16l-4-4 4-4" />
    </svg>
);

export default Home;
