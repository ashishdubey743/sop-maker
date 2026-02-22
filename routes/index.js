const express = require('express');
const router = express.Router();

const { isAuthenticated } = require('@middlewares/authMiddleware');
const authRoutes = require('@routes/authRoutes');
const MagicSOPController = require('@controllers/MagicSOPController');
const { SitemapStream, streamToPromise } = require('sitemap');

/**
 * Magic SOP Query
 */
router.post('/api/magic-sop', isAuthenticated, MagicSOPController.magicSOP);
const ModelAPIController = require('@controllers/ModelAPIController');
const ChatbotController = require('@controllers/ChatbotController');
const path = require('path');

/**
 * Auth Routes
 */
router.use('/auth', authRoutes);

/**
 * Chatbot CRUD
 */
router.put('/api/chatbot/:id',
    isAuthenticated,
    ChatbotController.updateMessageWithAnswer
);
router.post('/api/chatbot',
    isAuthenticated,
    ChatbotController.saveMessageInDatabase
);

/**
 * Chat with AI
 */
router.post('/api/chat',
    isAuthenticated,
    ModelAPIController.ChatWithAIModel
);

/**
 * Chat history
 */
router.get('/api/chatbot/session/:sessionId',
    isAuthenticated,
    ChatbotController.loadChatHistory
);

/**
* Clear chat history
*/
router.delete('/api/chatbot/clear',
    isAuthenticated,
    ChatbotController.clearChat
);

/**
 * Download SOP
 */
router.get('/download/doc/:filename',
    isAuthenticated,
    ChatbotController.downloadSOP
);

/**
 * Main page
 */
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

router.get('/sop-maker', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'chatbot.html'));
});

router.get('/sitemap.xml', async (req, res) => {
    try {
        const smStream = new SitemapStream({
            hostname: process.env.BASE_URL,
        });

        smStream.write({ url: '/', changefreq: 'daily', priority: 1.0 });
        smStream.write({ url: '/login.html', changefreq: 'monthly', priority: 0.5 });
        smStream.write({ url: '/chatbot.html', changefreq: 'monthly', priority: 0.5 });
        smStream.write({
            url: '/what-is-sop-maker.html',
            changefreq: 'weekly',
            priority: 0.9
        });

        smStream.end();

        const sitemap = await streamToPromise(smStream);

        res.header('Content-Type', 'application/xml');
        res.send(sitemap.toString());
    } catch (err) {
        res.status(500).send('Error generating sitemap');
    }
});

module.exports = router;