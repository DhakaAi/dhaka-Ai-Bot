require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-pro",
    systemInstruction: `তুমি 'Dhaka AI' (ঢাকা এআই), ঢাকা শহরের সাধারণ মানুষের দৈনন্দিন সমস্যার সমাধানকারী একজন স্মার্ট ও বন্ধুসুলভ লোকাল অ্যাসিস্ট্যান্ট।
তোমার কাজ:
১. ঢাকার লোকাল বাস রুট, মেট্রোরেল, সিএনজি ভাড়া এবং শর্টকাট রাস্তা সম্পর্কে সঠিক পরামর্শ দেওয়া।
২. কাঁচাবাজারের দরদাম, বাসা ভাড়া (To-Let), হাসপাতাল, ডাক্তার ও জরুরি সার্ভিস সম্পর্কে তথ্য দিয়ে সাহায্য করা।
৩. ইউজার বাংলা বা বাংলিশ (Banglish) যে ভাষাতেই মেসেজ দিক, তুমি সহজ, সুন্দর ও সংক্ষেপে (৩-৪ লাইনের মধ্যে) উত্তর দেবে।`
});

// ফ্রি ইউজারদের মেসেজ লিমিট ট্র্যাক করার মেমোরি (দৈনিক ৩টি ফ্রি মেসেজ)
const userUsage = new Map();
const FREE_DAILY_LIMIT = parseInt(process.env.FREE_DAILY_LIMIT || '3', 10);
const PAYMENT_LINK = process.env.PAYMENT_LINK || 'https://your-payment-link.com';

function checkUserLimit(phone) {
    const today = new Date().toISOString().slice(0, 10);
    const record = userUsage.get(phone);

    if (!record || record.date !== today) {
        userUsage.set(phone, { date: today, count: 1, isPremium: false });
        return { allowed: true, remaining: FREE_DAILY_LIMIT - 1 };
    }

    if (record.isPremium) {
        return { allowed: true, remaining: Infinity };
    }

    if (record.count >= FREE_DAILY_LIMIT) {
        return { allowed: false, remaining: 0 };
    }

    record.count += 1;
    userUsage.set(phone, record);
    return { allowed: true, remaining: FREE_DAILY_LIMIT - record.count };
}

// Health Check Endpoint (সার্ভার চালু আছে কিনা দেখার জন্য)
app.get('/', (req, res) => {
    res.status(200).send('Dhaka AI WhatsApp Bot Server is Running Successfully!');
});

// ১. WhatsApp Webhook Verification
app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN || 'dhaka_ai_secret_123';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token === verify_token) {
        console.log('Webhook Verified Successfully!');
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

// ২. ইউজারের মেসেজ রিসিভ এবং উত্তর পাঠানো
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object) {
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message && message.type === 'text') {
            const userPhone = message.from;
            const userText = message.text.body.trim();

            try {
                // ফ্রি লিমিট চেক করা
                const limitStatus = checkUserLimit(userPhone);
                let replyText = '';

                if (!limitStatus.allowed) {
                    replyText = `আপনার আজকের ${FREE_DAILY_LIMIT}টি ফ্রি প্রশ্নের লিমিট শেষ হয়ে গেছে! 🚀\n\nআনলিমিটেড প্রশ্ন করতে, রিয়েল-টাইম বাসা ভাড়ার অ্যালার্ট এবং জরুরি নম্বর পেতে আমাদের প্রিমিয়াম প্ল্যান (মাত্র ৯৯ টাকা/মাস) সাবস্ক্রাইব করুন:\n👉 ${PAYMENT_LINK}`;
                } else {
                    const result = await model.generateContent(userText);
                    const aiReply = result.response.text();
                    replyText = `${aiReply}\n\n_(আজকের বাকি ফ্রি মেসেজ: ${limitStatus.remaining}টি)_`;
                }

                // WhatsApp-এ উত্তর পাঠানো
                await axios({
                    method: 'POST',
                    url: `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
                    headers: {
                        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    data: {
                        messaging_product: 'whatsapp',
                        to: userPhone,
                        text: { body: replyText }
                    }
                });
            } catch (error) {
                console.error("Error processing message:", error.response?.data || error.message);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dhaka AI Server is running on port ${PORT}`);
});
