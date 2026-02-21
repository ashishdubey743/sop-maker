const chatbotService = require('@services/ChatbotService');
const docxService = require('@services/DocxService');

/**
 * Send user message to AI model.
 */
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
        let sopContent = data.choices?.[0]?.message?.content || "No response from AI";
        // Helper: detect if response is an SOP (has key SOP section headers)
        function isLikelySOP(text) {
            const headers = [
                /#\s*SOP[:\s]/i,
                /##\s*Purpose/i,
                /##\s*Scope/i,
                /##\s*Responsibilities/i,
                /##\s*Architecture Overview/i,
                /##\s*Procedure Steps/i
            ];
            let found = 0;
            for (const h of headers) {
                if (h.test(text)) found++;
            }
            return found >= 2; // At least 2 key sections
        }

        if (!sopContent.includes('SOP was not required for this query.') && isLikelySOP(sopContent)) {
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
        } else {
            sopContent = sopContent.replace('SOP was not required for this query.', '').trim();
            res.json({
                success: true,
                content: sopContent,
                docPath: null,
                botResponse: sopContent,
                sopTitle: null,
            });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            botResponse: "Error processing your request. Please try again later.",
            notionSuccess: false
        });
    }
}