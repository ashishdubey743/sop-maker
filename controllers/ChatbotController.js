const chatbotModel = require('@models/Chatbot');

exports.updateMessageWithAnswer = async (req, res) => {
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
}

exports.saveMessageInDatabase = async (req, res) => {
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
}

exports.loadChatHistory = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const messages = await chatbotModel.find({
            session: sessionId
        }).sort({ createdAt: 1 }); // Sort by creation time, oldest first

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

exports.downloadSOP = async (req, res) => {
    try {
        const { filename } = req.params;
        let chatbotRecord = await chatbotModel.find({ docPath: filename });
        const path = 'storage/temp/' + chatbotRecord[0].docPath;

        res.download(path, 'SOP-' + Date.now() + '.docx');
    } catch (error) {
        console.error('Error downloading document:', error);
        res.status(500).send('Error downloading document');
    }
}