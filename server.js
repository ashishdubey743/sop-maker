require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const connectDB = require('./database/connection');
const chatbotModel = require('./models/Chatbot');
const NotionService = require('./services/NotionService');
const docxService = require('./services/DocxService');
const notionService = new NotionService();
const cleanupService = require('./services/CleanupService');
cleanupService.scheduleCleanup();

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
        const { message, style = 'standard' } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Enhanced prompt with database table detection
        const prompt = notionService.getPrompt({message: message, style:style});

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
                            role: "system",
                            content: notionService.getTableAnalysisPrompt(),
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Chatbot API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const sopContent = data.choices?.[0]?.message?.content || "No response from AI";
        const sopTitle = notionService.getContentTitle(sopContent);
        try {
            const docBuffer = await docxService.createSopDocument(sopContent, sopTitle);
            const savedDocumentPath = await docxService.saveDocumentToFile(docBuffer, `./storage/temp/`, `${sopTitle.replace(/\s+/g, '_')}.docx`);
            res.json({
                sucess: true,
                content: sopContent,
                docxPath: savedDocumentPath,
                reply: `✅ SOP "${sopTitle}" created Successfully`,
                sopTitle: sopTitle,
            });
          } catch (error) {
            console.error('Error creating document:', error);
          }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            reply: "Error processing your request. Please try again later.",
            notionSuccess: false
        });
    }
});





// Create Notion page with proper formatting
async function createNotionPageWithTables(title, children, hasDatabaseTable) {
    const pageData = {
        parent: {
            type: "page_id",
            page_id: process.env.NOTION_PARENT_PAGE_ID
        },
        properties: {
            title: {
                title: [{ text: { content: title } }]
            }
        },
        children: children
    };

    // Add icon and cover for database-heavy SOPs
    if (hasDatabaseTable) {
        pageData.icon = { type: "emoji", emoji: "🗃️" };
        pageData.cover = {
            type: "external",
            external: {
                url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80"
            }
        };
    } else {
        pageData.icon = { type: "emoji", emoji: "📋" };
    }
    console.log(pageData);
    return fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify(pageData)
    });
}

/**
 * Get chat history for a specific session
 */
app.get('/api/chatbot/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const messages = await chatbotModel.find({
            session: sessionId
        }).sort({ createdAt: 1 }); // Sort by creation time, oldest first

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
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