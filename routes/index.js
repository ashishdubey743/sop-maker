const express = require('express');
const router = express.Router();

const { isAuthenticated } = require('@middlewares/authMiddleware');
const authRoutes = require('@routes/authRoutes');
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

module.exports = router;