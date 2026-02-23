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

        // 🔹 Setup SSE headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // 🔥 Send first chunk immediately
        res.write('data: {"heartbeat": true}\n\n');

        const heartbeatInterval = setInterval(() => {
            res.write('data: {"heartbeat": true}\n\n');
        }, 5000);

        const prompt = chatbotService.getPrompt({ message, style });
        const response = await fetch(process.env.CHATBOT_BASE_URL, {
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
                        content: prompt
                    }
                ],
                stream: true
            }),
        });

        if (!response.ok) {
            throw new Error(`AI API error: ${response.statusText}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullResponse = '';
        const headingSeen = new Set();
        const headingCarry = { value: '' };
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (let line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.replace('data: ', '').trim();
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const content = parsed?.choices?.[0]?.delta?.content;
                        if (content) {
                            fullResponse += content;

                            detectAndEmitHeadings({
                                textChunk: content,
                                carry: headingCarry,
                                seen: headingSeen,
                                res
                            });
                        }
                    } catch (err) {
                        // Ignore parsing errors
                    }
                }
            }
        }

        clearInterval(heartbeatInterval);
        let docPath = null;

        // 🔥 Only generate doc if SOP is required
        if (validateSOPHeadings(fullResponse).isValid) {
            const sopTitle = chatbotService.getContentTitle(fullResponse).replace(/[#$@%]/g, '');
            try {
                const docBuffer = await docxService.createSopDocument(fullResponse, sopTitle);
                const fileName = await docxService.saveDocumentToFile(docBuffer, `./storage/temp/`, `${sopTitle.replace(/\s+/g, '_')}.docx`);
                docPath = fileName;
                res.write(`data: ${JSON.stringify({
                    done: true,
                    response: `✅ SOP "${sopTitle}" created Successfully`,
                    docPath: docPath
                })}\n\n`);
            } catch (err) {
                console.error("Docx generation error:", err);
            }
        } else {
            res.write(`data: ${JSON.stringify({
                done: true,
                response: fullResponse,
                docPath: docPath
            })}\n\n`);
        }
        res.end();
    } catch (error) {
        console.error("Chat error:", error);
        clearInterval(heartbeatInterval);
        res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
        res.end();
    }
};

/**
 * Create SOP only when sop headings are passed.
 */
function validateSOPHeadings(fullResponse) {
    if (!fullResponse || typeof fullResponse !== 'string') {
        throw new Error('Invalid fullResponse input');
    }
    // Define required headings (case-insensitive)
    const requiredHeadings = [
        'Purpose',
        'Scope',
        'Architecture Overview',
        'Procedure Steps'
    ];

    const results = {};

    // Regex to match markdown heading style (## Heading OR --- newline then Heading)
    requiredHeadings.forEach(heading => {
        const regex = new RegExp(`(^|\\n)#+\\s*${heading}\\b|(^|\\n)${heading}\\b`, 'i');
        results[heading] = regex.test(fullResponse);
    });

    return {
        isValid: Object.values(results).every(Boolean),
        details: results
    };
}

/**
 * Helper function to detect and emit heading to show while creating response (in loader)
 */
function detectAndEmitHeadings({ textChunk, carry, seen, res }) {
    // keep a small rolling buffer because headings can arrive split across chunks
    carry.value = (carry.value + (textChunk || '')).slice(-500);

    // headings you want to detect
    const headingMap = [
        { key: 'Purpose', label: 'Started working on it…' },
        { key: 'Scope', label: 'Adding Scope…' },
        { key: 'Responsibilities', label: 'Adding Responsibilities…' },
        { key: 'Architecture Overview', label: 'Adding Architecture…' },
        { key: 'Prerequisites', label: 'Adding Prerequisites…' },
        { key: 'Dependencies', label: 'Adding Dependencies…' },
        { key: 'Data Model / Tables Affected', label: 'Adding Data Model…' },
        { key: 'Procedure Steps', label: 'Adding Steps…' },
        { key: 'Quality Checks / Validation', label: 'Adding Quality Checks…' },
        { key: 'Rollback Plan', label: 'Adding Rollback Plan…' },
    ];

    for (const h of headingMap) {
        if (seen.has(h.key)) continue;

        // matches: "## Scope" OR "# Scope" OR "\nScope\n" (loose)
        const re = new RegExp(`(^|\\n)#+\\s*${escapeRegExp(h.key)}\\b|(^|\\n)\\s*${escapeRegExp(h.key)}\\s*\\n`, 'i');

        if (re.test(carry.value)) {
            seen.add(h.key);
            res.write(`data: ${JSON.stringify({ heading: h.label })}\n\n`);
        }
    }
}

/**
 * Escapes special characters in a string.
 */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}