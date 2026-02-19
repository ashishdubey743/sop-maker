const chatbotService = require('@services/ChatbotService');
const docxService = require('@services/DocxService');


exports.ChatWithAIModel = async (req, res) => {
    try {
        const { message, style = 'standard' } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        // Enhanced prompt with database table detection
        const prompt = chatbotService.getPrompt({ message: message, style: style });

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
                            content: chatbotService.getTableAnalysisPrompt(),
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
        const sopTitle = chatbotService.getContentTitle(sopContent).replace(/[#$@%]/g, '');
        try {
            const docBuffer = await docxService.createSopDocument(sopContent, sopTitle);
            const fileName = await docxService.saveDocumentToFile(docBuffer, `./storage/temp/`, `${sopTitle.replace(/\s+/g, '_')}.docx`);
            res.json({
                success: true,
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
}