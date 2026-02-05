require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const connectDB = require('./database/connection');
const chatbotModel = require('./models/Chatbot');

connectDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.put('/api/chatbot/:id', async (req, res) => {
    try {
        const { answer } = req.body;
        const updatedMessage = await chatbotModel.findByIdAndUpdate(
            req.params.id,
            { answer: answer },
            { new: true, runValidators: true }
        );

        if (!updatedMessage) {
            return res.status(404).json({ error: 'Message not found' });
        }

        res.json(updatedMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/api/chatbot', async (req, res) => {
    try {
        const { question, answer, session } = req.body;
        console.log(req.body)
        const chatMessage = new chatbotModel({
            question: question,
            answer: answer || '', // Can be empty initially
            session: session || generateSessionId()
        });

        const savedMessage = await chatMessage.save();
        res.status(201).json(savedMessage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get Chatbot response from API call.
 */
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        const response = await fetch(
            `${process.env.CHATBOT_BASE_URL}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: process.env.CHATBOT_MODEL,
                    messages: [
                        {
                            role: "user",
                            content: message
                        }
                    ]
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Chatbot API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        const reply =
            data.choices?.[0]?.message?.content ||
            "No response from AI";

        res.json({ reply });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            reply: "AI service is currently unavailable. Please try again later."
        });
    }
});


/**
 * Serve the main page.
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Start the server.
 */
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});