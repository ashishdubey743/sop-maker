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
const session = require('express-session');
const googleAuth = require('./config/googleAuth');
const User = require('./models/User');
const crypto = require('crypto');
const { generateCodeVerifier } = require("arctic");

cleanupService.scheduleCleanup();

connectDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
};

app.get('/auth/google', async (req, res) => {
    try {
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = generateCodeVerifier();
        const scopes = ['profile', 'email'];

        const authorizationURL = await googleAuth.createAuthorizationURL(
            state,
            codeVerifier,
            scopes
        );

        // Save in session
        req.session.oauthState = state;
        req.session.codeVerifier = codeVerifier;

        await req.session.save();

        res.redirect(authorizationURL.toString());

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Failed to initiate Google login' });
    }
});

// 2. Google Callback
app.get('/auth/google/callback', async (req, res) => {
    try {
        const { code, state } = req.query;

        // Verify state
        if (!req.session.oauthState || state !== req.session.oauthState) {
            return res.status(400).send('Invalid state parameter');
        }

        // Exchange code for tokens
        const tokens = await googleAuth.validateAuthorizationCode(
            code,
            req.session.codeVerifier
        );
        const accessToken = tokens.accessToken();

        const refreshToken =
            "refresh_token" in tokens.data
                ? tokens.refreshToken()
                : null;
        const idToken = tokens.idToken;

        // Get user info from Google
        const googleResponse = await fetch(`${process.env.GOOGLE_INFO_BASE_URL}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });

        const googleUser = await googleResponse.json();

        // Find or create user
        let user = await User.findOne({ email: googleUser.email });

        if (!user) {
            user = await User.create({
                googleId: googleUser.sub,
                email: googleUser.email,
                name: googleUser.name,
                picture: googleUser.picture,
                emailVerified: googleUser.email_verified === 'true'
            });
        } else {
            // Update existing user
            user.googleId = googleUser.sub;
            user.name = googleUser.name;
            user.picture = googleUser.picture;
            user.lastLogin = new Date();
            await user.save();
        }

        // Store tokens (optional, if you need them later)
        user.accessToken = accessToken;
        user.refreshToken = refreshToken;
        const expiresIn = tokens.data.expires_in;
        user.tokensExpireAt = new Date(Date.now() + (expiresIn * 1000));
        await user.save();

        // Create session
        req.session.userId = user._id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;
        req.session.save();

        console.log('User Authenticated');
        // Redirect to frontend
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);

    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
});

// 3. Logout
app.post('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// 4. Get current user
app.get('/auth/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName,
        role: req.session.userRole
    });
});


app.put('/api/chatbot/:id', isAuthenticated, async (req, res) => {
    try {
        const { answer, docPath } = req.body;
        const updatedMessage = await chatbotModel.findByIdAndUpdate(
            req.params.id,
            { answer: answer, docPath: docPath },
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
app.post('/api/chatbot', isAuthenticated, async (req, res) => {
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
app.post('/api/chat', isAuthenticated, async (req, res) => {
    try {
        const { message, style = 'standard' } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Enhanced prompt with database table detection
        const prompt = notionService.getPrompt({ message: message, style: style });

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
            const fileName = await docxService.saveDocumentToFile(docBuffer, `./storage/temp/`, `${sopTitle.replace(/\s+/g, '_')}.docx`);
            res.json({
                sucess: true,
                content: sopContent,
                docPath: fileName,
                botResponse: `✅ SOP "${sopTitle}" created Successfully`,
                sopTitle: sopTitle,
            });
        } catch (error) {
            console.error('Error creating document:', error);
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            botResponse: "Error processing your request. Please try again later.",
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
                url: `${process.env.DEFAULT_SOP_IMAGE_URL}`
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
app.get('/api/chatbot/session/:sessionId', isAuthenticated, async (req, res) => {
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

app.get('/download/doc/:filename', isAuthenticated, async (req, res) => {
    try {
        const { filename } = req.params;
        let chatbotRecord = await chatbotModel.find({ docPath: filename });
        console.log(chatbotRecord);
        const path = 'storage/temp/' + chatbotRecord[0].docPath;

        res.download(path, 'SOP-' + Date.now() + '.docx');
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).send('Error downloading document');
    }
});

/**
 * Start the server.
 */
app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});