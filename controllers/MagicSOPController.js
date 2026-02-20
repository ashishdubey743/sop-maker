const chatbotService = require('@services/ChatbotService');

exports.magicSOP = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        // Prompt to convert user text to a technical SOP query
        const prompt = `Convert the following user request into a clear, technical SOP query for an enterprise system. Make sure the result is specific, actionable, and suitable for SOP generation. Do not answer, just rewrite the query:
\nUser request: "${text}"`;

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
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2
                })
            }
        );

        if (!response.ok) {
            return res.status(500).json({ error: 'AI model error' });
        }

        const data = await response.json();
        const sopQuery = data.choices?.[0]?.message?.content || text;
        res.json({ sopQuery });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
