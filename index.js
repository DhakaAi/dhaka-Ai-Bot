require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();

// Very Important: Express JSON middleware must be right before routes
app.use(express.json());

// Gemini AI Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Health Check Endpoint
app.get('/', (req, res) => {
    res.status(200).send('Dhaka AI WhatsApp Bot Server is Running Successfully!');
});

// ১. WhatsApp Webhook Verification (GET)
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

// ২. WhatsApp Webhook Message Receiver (POST)
app.post('/webhook', async (req, res) => {
    // Immediately send 200 OK to Meta so it doesn't timeout
    res.sendStatus(200);

    try {
        const body = req.body;
        console.log("Incoming Webhook Payload:", JSON.stringify(body, null, 2));

        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;
            const message = value?.messages?.[0];

            if (message && message.type === 'text') {
                const userPhone = message.from;
                const userText = message.text.body.trim();

                console.log(`Received message from ${userPhone}: ${userText}`);

                // Gemini AI Prompt
                const prompt = `তুমি 'Dhaka AI' (ঢাকা এআই), ঢাকা শহরের লোকাল অ্যাসিস্ট্যান্ট। ইউজারকে সহজ, বন্ধুসুলভ ও সংক্ষেপে (৩-৪ লাইনের মধ্যে) উত্তর দাও। ইউজারের প্রশ্ন: "${userText}"`;
                
                const result = await model.generateContent(prompt);
                const aiReply = result.response.text();

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
                        text: { body: aiReply }
                    }
                });
                console.log("Reply sent successfully to WhatsApp!");
            }
        }
    } catch (error) {
        console.error("Error processing message:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Dhaka AI Server is running on port ${PORT}`);
});
