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
// app.post('/api/chat', async (req, res) => {
//     try {
//         const { message } = req.body;

//         if (!message) {
//             return res.status(400).json({ error: "Message is required" });
//         }

//         const response = await fetch(
//             `${process.env.CHATBOT_BASE_URL}`,
//             {
//                 method: 'POST',
//                 headers: {
//                     'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     model: process.env.CHATBOT_MODEL,
//                     messages: [
//                         {
//                             role: "user",
//                             content: message
//                         }
//                     ]
//                 })
//             }
//         );

//         if (!response.ok) {
//             const errText = await response.text();
//             throw new Error(`Chatbot API error: ${response.status} - ${errText}`);
//         }

//         const data = await response.json();

//         const reply =
//             data.choices?.[0]?.message?.content ||
//             "No response from AI";

//         res.json({ reply });

//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({
//             reply: "AI service is currently unavailable. Please try again later."
//         });
//     }
// });

app.post('/api/chat', async (req, res) => {
    try {
        const { message, style = 'standard' } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Enhanced prompt to force structured SOP output
        const enhancedPrompt = `
        The user wants to create a Standard Operating Procedure (SOP). 
        Based on their input: "${message}"
        
        Generate a COMPLETE SOP in ONE OF THESE STRUCTURES:
        
        ${style === 'quick' ? `
        ## QUICK SOP FORMAT:
        **Title:** [Clear procedure name]
        **Purpose:** [1-2 sentences]
        **Steps:**
        1. [Step 1]
        2. [Step 2]
        3. [Step 3]
        **Responsible:** [Role/Person]
        **Documents:** [Any forms/tools needed]
        ` : style === 'detailed' ? `
        ## DETAILED SOP FORMAT:
        ### SOP TITLE: [Name]
        ### 1. PURPOSE
        [Why this exists]
        
        ### 2. SCOPE
        [Who/What this applies to]
        
        ### 3. RESPONSIBILITIES
        - [Role 1]: [Tasks]
        - [Role 2]: [Tasks]
        
        ### 4. PROCEDURE STEPS
        Step 1: [Action]
        Step 2: [Action]
        Step 3: [Action]
        
        ### 5. QUALITY CHECKS
        [Verification points]
        
        ### 6. DOCUMENTATION
        [Records to keep]
        ` : `
        ## STANDARD SOP FORMAT:
        **Procedure:** [What's being documented]
        **Purpose:** [Why it's important - 2-3 sentences]
        **Applicable To:** [Department/Role]
        **Procedure Steps:**
        ① [First action with verb]
        ② [Second action with verb]
        ③ [Third action with verb]
        **Responsible Persons:**
        - [Role]: [Specific duty]
        **Tools/Documents:**
        - [Form/Tool 1]
        **Important Notes:**
        - [Warning or tip]
        `}
        
        IMPORTANT RULES:
        1. Generate COMPLETE SOP - don't leave placeholders like [ ]
        2. Use ACTUAL content based on user's description
        3. Keep it practical and actionable
        4. Format with clear headings and bullet points
        5. Include 3-5 main steps
        6. Make it ready to use immediately
        
        Output ONLY the SOP, no additional explanations.
        `;

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
                            content: "You are an expert SOP writer who creates clear, practical Standard Operating Procedures. Always output complete, ready-to-use SOPs."
                        },
                        {
                            role: "user",
                            content: enhancedPrompt
                        }
                    ],
                    temperature: 0.3 // Lower temp for more consistent structure
                })
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Chatbot API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();

        const sopContent = data.choices?.[0]?.message?.content || "No response from AI";

        // Extract SOP title from content
        const titleMatch = sopContent.match(/(?:Title:|SOP TITLE:|Procedure:)\s*(.+?)(?:\n|$)/i);
        const sopTitle = titleMatch ? titleMatch[1].trim() : `SOP - ${new Date().toLocaleDateString()}`;

        // Create SOP in Notion
        const notionResponse = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: {
                    type: "page_id",
                    page_id: process.env.NOTION_PARENT_PAGE_ID || "2e32607e24f98093b4aedd476d650011"
                },
                properties: {
                    title: {
                        title: [
                            {
                                text: {
                                    content: sopTitle
                                }
                            }
                        ]
                    }
                },
                children: parseSOPToNotionBlocks(sopContent, style)
            })
        });

        if (!notionResponse.ok) {
            console.error('Notion API error:', await notionResponse.text());
            // Still return SOP content even if Notion fails
            return res.json({
                reply: sopContent,
                notionSuccess: false,
                message: "SOP generated but failed to save to Notion"
            });
        }

        const notionData = await notionResponse.json();
        const notionUrl = notionData.url || `https://notion.so/${notionData.id.replace(/-/g, '')}`;

        res.json({
            reply: `${sopContent}\n\n---\n✅ **SOP has been saved to Notion!**\n📄 View it here: ${notionUrl}`,
            notionSuccess: true,
            notionUrl: notionUrl,
            sopTitle: sopTitle
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            reply: "Error processing your request. Please try again later.",
            notionSuccess: false
        });
    }
});

// Helper function to convert SOP text to Notion blocks
function parseSOPToNotionBlocks(sopContent, style) {
    const lines = sopContent.split('\n');
    const blocks = [];
    
    lines.forEach(line => {
        if (!line.trim()) return;
        
        let block = null;
        
        // Detect headings
        if (line.match(/^#{1,3}\s/) || line.match(/^[A-Z][A-Z\s]+\:/)) {
            block = {
                object: "block",
                type: "heading_2",
                heading_2: {
                    rich_text: [{
                        type: "text",
                        text: { content: line.replace(/^#{1,3}\s/, '').replace(/^\*\*|\*\*$/g, '') }
                    }]
                }
            };
        }
        // Detect numbered steps
        else if (line.match(/^\d+[\.\)]\s/) || line.match(/^[①②③④⑤]\s/)) {
            block = {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{
                        type: "text",
                        text: { content: line }
                    }]
                }
            };
        }
        // Detect bullet points
        else if (line.match(/^[-•*]\s/)) {
            block = {
                object: "block",
                type: "bulleted_list_item",
                bulleted_list_item: {
                    rich_text: [{
                        type: "text",
                        text: { content: line.substring(2) }
                    }]
                }
            };
        }
        // Regular paragraphs
        else {
            block = {
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: [{
                        type: "text",
                        text: { content: line }
                    }]
                }
            };
        }
        
        if (block) blocks.push(block);
    });
    
    return blocks;
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