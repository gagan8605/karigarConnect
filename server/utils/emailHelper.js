const SibApiV3Sdk = require('sib-api-v3-sdk');

// Initialize Brevo API client
const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = String(process.env.BREVO_API_KEY || '').trim();

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

console.log('[EMAIL] Brevo API initialized (HTTP/HTTPS, port 443)');

const isBrevoIpRestrictionError = (err) => {
    const message = String(err?.response?.body?.message || err?.message || '').toLowerCase();
    return message.includes('unrecognised ip address')
        || message.includes('unrecognized ip address')
        || message.includes('authorised ip')
        || message.includes('authorized ip');
};

const requireBrevoConfig = () => {
    if (!process.env.BREVO_API_KEY) {
        throw new Error('BREVO_API_KEY is missing. Configure a Brevo v3 API key.');
    }

    if (!process.env.EMAIL_FROM) {
        throw new Error('EMAIL_FROM is missing. Configure a verified Brevo sender email.');
    }
};

exports.sendEmailMessage = async ({ to, subject, text, html, logPrefix = '[EMAIL]' }) => {
    if (!to || !subject || (!text && !html)) {
        throw new Error('to, subject and text/html are required.');
    }

    requireBrevoConfig();

    try {
        const startedAt = Date.now();
        const result = await tranEmailApi.sendTransacEmail({
            sender: {
                email: process.env.EMAIL_FROM,
                name: 'KarigarConnect',
            },
            to: [{ email: to }],
            subject,
            htmlContent: html || text,
            textContent: text,
        });

        const elapsedMs = Date.now() - startedAt;
        console.log(`${logPrefix} Sent to ${to} in ${elapsedMs}ms. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, elapsedMs };
    } catch (err) {
        const errorMsg = err.response?.body?.message || err.message || 'Unknown error';
        console.error(`${logPrefix} Failed sending to ${to}:`, errorMsg);
        throw err;
    }
};

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    requireBrevoConfig();

    const subject = 'Your KarigarConnect OTP';
    const htmlContent = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2 style="color:#ea580c;margin-bottom:8px">KarigarConnect OTP Verification</h2>
            <p>Your OTP is:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:2px;color:#ea580c;margin:8px 0">${otp}</p>
            <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
            <hr style="margin:20px 0;border:none;border-top:1px solid #ddd"/>
            <p style="font-size:12px;color:#999">If you did not request this OTP, please ignore this email.</p>
        </div>
    `;
    const textContent = `Your KarigarConnect OTP is ${otp}. It is valid for 5 minutes. Do not share this OTP with anyone.`;

    try {
        const startedAt = Date.now();
        const result = await tranEmailApi.sendTransacEmail({
            sender: {
                email: process.env.EMAIL_FROM,
                name: 'KarigarConnect',
            },
            to: [{ email: to }],
            subject,
            htmlContent,
            textContent,
        });

        const elapsedMs = Date.now() - startedAt;
        console.log(`[EMAIL OTP] Sent to ${to} in ${elapsedMs}ms. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, elapsedMs };
    } catch (err) {
        const errorMsg = err.response?.body?.message || err.message || 'Unknown error';
        console.error(`[EMAIL OTP] Failed sending to ${to}:`, errorMsg);

        if (process.env.NODE_ENV !== 'production' && isBrevoIpRestrictionError(err)) {
            console.warn(`[EMAIL OTP] Development fallback enabled for ${to}; Brevo rejected the current IP.`);
            return { success: true, devFallback: true, messageId: 'dev-fallback' };
        }

        throw err;
    }
};
