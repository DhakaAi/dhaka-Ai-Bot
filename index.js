require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => {
    res.status(200).send('Dhaka AI WhatsApp Bot Server is Running Successfully!');
});

app.get('/webhook', (req, res) => {
    const verify_token = process.env.VERIFY_TOKEN || 'dhaka_ai_secret_123';
    if (req.query['hub.mode'] && req.query['hub.verify_token'] === verify_token) {
        console.log('Webhook Verified Successfully!');
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
    // Meta expects 200 OK immediately
    res.sendStatus(200);

    try {
        console.log("=== RAW WEBHOOK RECEIVED ===");
        console.log(JSON.stringify(req.body, null, 2));

        const body = req.body;
        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (message && message.type === 'text') {
            const userPhone = message.from;
            const userText = message.text.body.trim();

            console.log(`Processing text message from ${userPhone}: "${userText}"`);

            const prompt = `তুমি 'Dhaka AI' (ঢাকা এআই), ঢাকা শহরের লোকাল অ্যাসিস্ট্যান্ট। ইউজারকে সহজ, বন্ধুসুলভ ও সংক্ষেপে (৩-৪ লাইনের মধ্যে) উত্তর দাও। ইউজারের প্রশ্ন: "${userText}"`;
            
            const result = await model.generateContent(prompt);
            const aiReply = result.response.text();

            console.log(`AI Reply generated: "${aiReply}"`);

            const wpResponse = await axios({
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

            console.log("WhatsApp API Response Status:", wpResponse.status);
        } else {
            console.log("Webhook received, but no valid text message found inside payload.");
        }
    } catch (error) {
        console.error("CRITICAL ERROR in webhook:", error.response?.data || error.message);
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Dhaka AI Server is running on port ${PORT}`);
});
