// client/src/pages/auth/Register.jsx
// PREMIUM VERSION - Modern gradient design with smooth animations
// All original functionality preserved including Shop Owner registration card

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Briefcase, Sparkles, ArrowRight, Star, Store, Shield,
  Crown, Diamond, Zap, Gift, Heart, ThumbsUp, TrendingUp,
  Award, CheckCircle, Rocket, Users, Handshake, Target
} from 'lucide-react';

const CARDS = [
    {
        to: '/register/worker',
        icon: Briefcase,
        iconBg: 'from-orange-500 to-amber-500',
        iconBgLight: 'from-orange-50 to-amber-50',
        title: 'I am a Karigar',
        titleHover: 'group-hover:text-orange-600',
        ctaColor: 'text-orange-600',
        ctaHover: 'group-hover:text-orange-700',
        starColor: 'text-orange-400',
        hoverBg: 'from-orange-500/5 to-amber-500/5',
        cta: 'Get Started',
        desc: 'Showcase your skills, find rewarding projects, and build your professional reputation with clients who value quality work.',
        features: ['Work Opportunities', 'Skill Recognition', 'Professional Growth'],
        gradient: 'orange',
    },
    {
        to: '/register/client',
        icon: User,
        iconBg: 'from-blue-500 to-cyan-500',
        iconBgLight: 'from-blue-50 to-cyan-50',
        title: 'I am a Client',
        titleHover: 'group-hover:text-blue-600',
        ctaColor: 'text-blue-600',
        ctaHover: 'group-hover:text-blue-700',
        starColor: 'text-blue-400',
        hoverBg: 'from-blue-500/5 to-cyan-500/5',
        cta: 'Find Karigars',
        desc: 'Find verified, skilled professionals for your projects. Get quality work done with transparent pricing and reliable service.',
        features: ['Verified Professionals', 'Transparent Pricing', 'Quality Assurance'],
        gradient: 'blue',
    },
    {
        to: '/shop/register',
        icon: Store,
        iconBg: 'from-teal-500 to-emerald-500',
        iconBgLight: 'from-teal-50 to-emerald-50',
        title: 'I am a Shop Owner',
        titleHover: 'group-hover:text-teal-600',
        ctaColor: 'text-teal-600',
        ctaHover: 'group-hover:text-teal-700',
        starColor: 'text-teal-400',
        hoverBg: 'from-teal-500/5 to-emerald-500/5',
        cta: 'Register Shop',
        desc: 'Register your tool or hardware shop and offer exclusive discounts to verified workers through the KarigarConnect coupon system.',
        features: ['Exclusive Discounts', 'Verified Workers', 'Coupon System'],
        gradient: 'teal',
        badge: 'New',
    },
];

const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
};

const staggerContainer = {
    animate: { transition: { staggerChildren: 0.1 } }
};

const Register = () => {
    const getGradientClasses = (gradient, isText = false) => {
        if (isText) {
            if (gradient === 'orange') return 'text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500';
            if (gradient === 'blue') return 'text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500';
            if (gradient === 'teal') return 'text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-emerald-500';
            return '';
        }
        if (gradient === 'orange') return 'from-orange-500 to-amber-500';
        if (gradient === 'blue') return 'from-blue-500 to-cyan-500';
        if (gradient === 'teal') return 'from-teal-500 to-emerald-500';
        return '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 flex items-center justify-center p-4">
            <div className="max-w-6xl w-full py-8">
                
                {/* Hero Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                        className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl mb-5 shadow-lg shadow-orange-200"
                    >
                        <Sparkles className="h-8 w-8 text-white" />
                    </motion.div>
                    <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 bg-clip-text text-transparent">
                        Join KarigarConnect
                    </h1>
                    <p className="text-lg text-gray-500 mt-3 max-w-xl mx-auto">
                        Where skilled professionals, clients, and shop owners come together
                    </p>
                </motion.div>



                {/* Cards Grid */}
                <motion.div 
                    variants={staggerContainer}
                    initial="initial"
                    animate="animate"
                    className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
                >
                    {CARDS.map((card, idx) => {
                        const IconComp = card.icon;
                        const gradientClass = getGradientClasses(card.gradient);
                        
                        return (
                            <motion.div
                                key={card.to}
                                variants={fadeInUp}
                                whileHover={{ y: -8 }}
                                transition={{ type: 'spring', stiffness: 300 }}
                            >
                                <Link to={card.to} className="block group">
                                    <div className="relative bg-white rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 h-full">
                                        
                                        {/* Hover overlay */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${card.hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                        
                                        {/* New Badge */}
                                        {card.badge && (
                                            <div className="absolute top-4 right-4 z-20">
                                                <motion.div 
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: 'spring', delay: 0.2 + idx * 0.1 }}
                                                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-md"
                                                >
                                                    <Sparkles size="8" />
                                                    {card.badge}
                                                </motion.div>
                                            </div>
                                        )}

                                        {/* Decorative Star */}
                                        <div className="absolute top-4 left-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                                            <Star className={`h-16 w-16 ${card.starColor}`} />
                                        </div>

                                        <div className="relative z-10 p-8">
                                            {/* Icon */}
                                            <motion.div 
                                                whileHover={{ scale: 1.1, rotate: 5 }}
                                                transition={{ type: 'spring', stiffness: 400 }}
                                                className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${card.iconBg} shadow-md mb-6`}
                                            >
                                                <IconComp className="h-10 w-10 text-white" />
                                            </motion.div>

                                            {/* Title */}
                                            <h3 className={`text-xl font-black text-gray-800 mb-2 transition-colors duration-300 ${card.titleHover}`}>
                                                {card.title}
                                            </h3>

                                            {/* Description */}
                                            <p className="text-gray-500 text-sm mb-4 leading-relaxed">{card.desc}</p>

                                            {/* Features List */}
                                            <div className="space-y-1.5 mb-5">
                                                {card.features.map((feature, i) => (
                                                    <motion.div 
                                                        key={i}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.1 + i * 0.05 }}
                                                        className="flex items-center gap-1.5 text-xs"
                                                    >
                                                        <CheckCircle size="10" className={`text-${card.gradient}-500 flex-shrink-0`} />
                                                        <span className="text-gray-600">{feature}</span>
                                                    </motion.div>
                                                ))}
                                            </div>

                                            {/* CTA Button */}
                                            <motion.div 
                                                whileHover={{ x: 4 }}
                                                className={`flex items-center font-bold transition-all duration-300 ${card.ctaColor} ${card.ctaHover}`}
                                            >
                                                <span>{card.cta}</span>
                                                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1.5 transition-transform duration-300" />
                                            </motion.div>
                                        </div>

                                        {/* Bottom Gradient Bar */}
                                        <div className={`h-1 w-full bg-gradient-to-r ${card.iconBg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </motion.div>



                {/* Login Link */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-center space-y-2"
                >
                    <p className="text-gray-600 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="font-bold text-orange-600 hover:text-orange-700 transition-colors underline underline-offset-4">
                            Login here
                        </Link>
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span>🔒 Secure Registration</span>
                        <span>•</span>
                        <span>⚡ Fast Verification</span>
                        <span>•</span>
                        <span>💯 Free to Join</span>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Register;