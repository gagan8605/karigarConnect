// client/src/utils/razorpayHelper.js
// Razorpay payment gateway integration helper

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API = axios.create({ baseURL: BASE_URL });
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('token');
    if (token) req.headers.Authorization = `Bearer ${token}`;
    return req;
});

/**
 * Load Razorpay script dynamically
 */
export const loadRazorpayScript = () => {
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
};

/**
 * Initiate Razorpay payment
 */
export const initiateRazorpayPayment = async (paymentData) => {
    // eslint-disable-next-line no-useless-catch
    try {
        const hasRazorpay = typeof window !== 'undefined' && typeof window.Razorpay === 'function';
        if (!hasRazorpay) {
            const loaded = await loadRazorpayScript();
            if (!loaded || typeof window.Razorpay !== 'function') {
                throw new Error('Razorpay SDK failed to load. Please refresh and try again.');
            }
        }

        // Step 1: Create Razorpay order
        const orderResponse = await API.post('/api/client/payment/razorpay/create-order', {
            jobId: paymentData.jobId,
            workerId: paymentData.workerId,
            slotId: paymentData.slotId,
            amount: paymentData.amount,
            skill: paymentData.skill,
            priceSource: paymentData.priceSource,
        });

        if (!orderResponse.data.success) {
            throw new Error(orderResponse.data.message || 'Failed to create payment order');
        }

        const { razorpayOrderId, keyId } = orderResponse.data;

        // Step 2: Initialize Razorpay Checkout
        return new Promise((resolve, reject) => {
            const amountInPaise = Math.round(Number(paymentData.amount || 0) * 100);
            const options = {
                key: keyId,
                amount: amountInPaise,
                currency: 'INR',
                name: 'Karigar Connect',
                description: `Payment for ${paymentData.skill}`,
                order_id: razorpayOrderId,
                handler: async (response) => {
                    try {
                        // Step 3: Verify payment on backend
                        const verifyResponse = await API.post('/api/client/payment/razorpay/verify', {
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpayOrderId: response.razorpay_order_id,
                            razorpaySignature: response.razorpay_signature,
                        });

                        if (verifyResponse.data.success) {
                            resolve({
                                success: true,
                                paymentId: response.razorpay_payment_id,
                                orderId: response.razorpay_order_id,
                                transactionId: verifyResponse.data.transactionId,
                            });
                        } else {
                            reject(new Error(verifyResponse.data.message || 'Payment verification failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                },
                prefill: {
                    name: paymentData.clientName || '',
                    email: paymentData.clientEmail || '',
                    contact: paymentData.clientPhone || '',
                },
                notes: {
                    jobId: paymentData.jobId,
                    workerId: paymentData.workerId,
                    skill: paymentData.skill,
                },
                theme: {
                    color: '#f97316', // Karigar orange
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (response) => {
                reject(new Error(`Payment failed: ${response.error.description}`));
            });
            rzp.open();
        });
    } catch (error) {
        throw error;
    }
};

/**
 * Start cash payment OTP verification flow
 */
export const initiateCashOtpPayment = async (paymentData) => {
    const response = await API.post('/api/client/payment/cash/send-otp', {
        jobId: paymentData.jobId,
        workerId: paymentData.workerId,
        slotId: paymentData.slotId,
        amount: paymentData.amount,
        skill: paymentData.skill,
        priceSource: paymentData.priceSource,
    });
    return response.data;
};

/**
 * Resend cash OTP
 */
export const resendCashOtpPayment = async (transactionId) => {
    const response = await API.post('/api/client/payment/cash/resend-otp', { transactionId });
    return response.data;
};

/**
 * Verify cash OTP and mark payment complete
 */
export const verifyCashOtpPayment = async ({ transactionId, otp }) => {
    const response = await API.post('/api/client/payment/cash/verify-otp', { transactionId, otp });
    return response.data;
};

/**
 * Fetch payment history
 */
export const fetchPaymentHistory = async (limit = 10, skip = 0) => {
    const response = await API.get('/api/client/payment/razorpay/transactions', {
        params: { limit, skip },
    });
    return response.data;
};

/**
 * Get single transaction details
 */
export const getTransactionDetails = async (transactionId) => {
    const response = await API.get(`/api/client/payment/razorpay/transactions/${transactionId}`);
    return response.data;
};

/**
 * Request refund
 */
export const requestRefund = async (transactionId) => {
    const response = await API.post(`/api/client/payment/razorpay/refund/${transactionId}`);
    return response.data;
};
