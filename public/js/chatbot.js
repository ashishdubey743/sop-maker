/**
 * ChatBot class.
 */
class ChatBot {

    /**
     * Constructor.
     */
    constructor() {
        this.lastMessageId = '';
        this.coversationAvailable = false;
        this.suggestedQuestions = [];
        this.currentSession = this.getCurrentSession();
        this.initializeEventListeners();
        this.loadSuggestions();
        this.loadChatHistory();
        this.loading = false;
    }

    /**
     * Load suggested questions from a JSON file
     */
    async loadSuggestions() {
        try {
            const resp = await fetch('/json/suggestions.json');
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data)) {
                    this.suggestedQuestions = data;
                }
            }
        } catch (err) {
            console.error('Failed to load suggestions.json:', err);
        }

        const emptyState = document.getElementById('emptyState');
        if (emptyState && emptyState.style.display !== 'none') {
            this.renderSuggestedQuestions();
        }
    }

    /**
     * Load chat history from database for current session
     */
    async loadChatHistory() {
        try {
            const response = await fetch(`/api/chatbot/session/${this.currentSession}`);

            if (response.ok) {
                const emptyState = document.getElementById('emptyState');


                const messages = await response.json();

                if (messages.length > 0) {
                    emptyState.style.display = 'none';
                    this.coversationAvailable = true;
                    // Display all messages from the session
                    messages.forEach(msg => {
                        if (msg.question) {
                            this.addMessage(msg.question, 'user', false);
                        }
                        if (msg.answer) {
                            this.addMessage(msg.answer, 'bot', msg.docPath);
                        }
                    });
                    // Scroll to very bottom after loading chat history
                    setTimeout(() => {
                        this.moveToBottom();
                    }, 100);
                } else {
                    emptyState.style.display = 'flex';
                    this.renderSuggestedQuestions();
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }

    /**
     * Move the user to the bottom of the chat container to see the latest messages.
     */
    moveToBottom() {
        const chatContainer = document.getElementById('chatContainer');
        const chatContent = document.getElementById('chatContainerContent');
        if (chatContent && chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
            chatContent.scrollTop = chatContent.scrollHeight;
        }
    }
    /**
     * Render suggested questions in the empty state and attach click handlers.
     */
    renderSuggestedQuestions() {
        const emptyState = document.getElementById('emptyState');
        console.log('Empty state element:', emptyState);
        if (!emptyState) return;

        const block = document.getElementById('suggestionsBlock');
        const list = document.getElementById('suggestionsList');
        const template = document.getElementById('suggestionTemplate');
        if (!block || !list || !template) return;

        // Clear any existing suggestion nodes
        list.innerHTML = '';
        console.log('Rendering suggested questions:', this.suggestedQuestions);
        if (!this.suggestedQuestions || this.suggestedQuestions.length === 0) {
            block.classList.add('hidden');
            return;
        }

        this.suggestedQuestions.forEach(q => {
            const btn = template.cloneNode(true);
            btn.removeAttribute('id');
            btn.classList.remove('hidden');
            btn.textContent = q;
            btn.addEventListener('click', () => {
                const input = document.getElementById('messageInput');
                input.value = q;
                emptyState.style.display = 'none';
                this.sendMessage();
            });
            list.appendChild(btn);
        });

        block.classList.remove('hidden');
    }

    /**
     * Initialize event listeners.
     */
    initializeEventListeners() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendButton');
        const validation = document.getElementById('inputValidation');

        const minLength = 10;

        const validateInput = () => {
            const text = input.value.trim();

            const isValidLength = text.length >= minLength;

            if (!isValidLength) {
                validation.classList.remove('hidden');
                sendBtn.disabled = true;
                return false;
            }

            validation.classList.add('hidden');
            sendBtn.disabled = false;
            return true;
        };

        input.addEventListener('input', validateInput);

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (validateInput()) {
                    this.sendMessage();
                }
            }
        });

        sendBtn.onclick = () => {
            if (validateInput()) {
                this.sendMessage();
            }
        };
    }

    /**
     * Send message to chatbot.
     */
    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();

        if (message.length < 10 || this.loading) return;
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'none';
        this.addMessage(message, 'user');
        // Save user message and get the document ID
        this.saveMessageInDatabase({
            message: message,
            role: 'user',
            session: this.getCurrentSession() // You'll need to track sessions
        }).then(documentId => {
            // Store the document ID for updating later
            this.lastMessageId = documentId;
        });

        input.value = '';

        this.showTypingIndicator();

        // Use API endpoint or local response
        this.getBotResponse(message).then(({ botResponse, docPath }) => {
            this.hideTypingIndicator();
            // Update the same document with bot's response
            this.updateMessageWithAnswer({
                messageId: this.lastMessageId,
                answer: botResponse,
                docPath: docPath
            });

            this.addMessage(botResponse, 'bot', docPath);
        });
    }

    async saveMessageInDatabase({ message, role, session }) {
        if (role === 'user') {
            // Create a new document with only the question
            try {
                const response = await fetch('/api/chatbot', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        question: message,
                        answer: '', // Empty initially
                        session: session || this.getCurrentSession()
                    })
                });

                const data = await response.json();
                return data._id; // Return the document ID
            } catch (error) {
                console.error('Error saving message:', error);
                return null;
            }
        }
    }

    async updateMessageWithAnswer({ messageId, answer, docPath }) {
        if (!messageId) return;

        try {
            const response = await fetch(`/api/chatbot/${messageId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    answer: answer,
                    docPath: docPath
                })
            });

            return await response.json();
        } catch (error) {
            console.error('Error updating message:', error);
        }
    }

    getCurrentSession() {
        let sessionId = localStorage.getItem('chat_session');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
            localStorage.setItem('chat_session', sessionId);
        }
        return sessionId;
    }

    /**
     * Get bot response from server API.
     */
    async getBotResponse(message) {
        try {
            // Try to get response from server API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: message })
            });

            if (response.ok) {
                const data = await response.json();
                return { botResponse: data.botResponse, docPath: data.docPath };
            }
        } catch (error) {
            console.log('Error processing request:', error);
        }
    }

    /**
     * Show typing indicator.
     */
    showTypingIndicator() {
        this.loading = true;
        const chatContainer = document.getElementById('chatContainer');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message mb-6';
        typingDiv.innerHTML = `
           <div class="flex items-center space-x-2">
                <div class="w-8 h-8 border-2 border-primary border-t-purple-600 rounded-full animate-spin"></div>
                <span class="font-bold text-lg text-black">Thinking...</span>
            </div>
        `;
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Hide typing indicator.
     */
    hideTypingIndicator() {
        this.loading = false;
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    /**
     * Add message to chat container.
     */
    addMessage(text, sender, filename = null) {
        const chatContainer = document.getElementById('chatContainerContent');
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messageDiv = document.createElement('div');
        messageDiv.className = `message mb-6 ${sender === 'user' ? 'flex justify-end' : ''}`;

        // Format code blocks if present
        let formattedText = this.formatCodeBlocks(text);

        if (sender === 'user') {
            messageDiv.innerHTML = `
                <div class="max-w-lg">
                    <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl rounded-tr-none px-4 py-3">
                        <p>${text}</p>
                    </div>
                    <p class="text-gray-500 text-sm mt-1 text-right">${timeString}</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="flex items-start space-x-3">
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-robot text-white text-sm"></i>
                    </div>
                    <div class="bg-blue-50 rounded-2xl rounded-tl-none px-4 py-3 max-w-lg">
                        <div class="text-gray-800 whitespace-pre-line">${formattedText}</div>
                        ${filename ? `
                            <div class="mt-3">
                                <a class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 cursor-pointer" href="/download/doc/${filename}" download>
                                    Export SOP
                                </a>
                            </div>
                            ` : ''}
                        <p class="text-gray-500 text-sm mt-2">${timeString}</p>
                    </div>
                </div>
            `;
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /**
     * Format code blocks.
     */
    formatCodeBlocks(text) {
        // Simple code block formatting
        return text.replace(/```javascript\n([\s\S]*?)\n```/g, (match, code) => {
            const escapedCode = code
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/const|let|var|function|return|require/g, '<span class="code-keyword">$&</span>')
                .replace(/'[^']*'|"[^"]*"/g, '<span class="code-string">$&</span>')
                .replace(/\/\/.*/g, '<span class="code-comment">$&</span>');

            return `<div class="code-block">${escapedCode}</div>`;
        });
    }

    /**
    * Clear the current user conversation.
    */
    async clearChat() {
        try {
            // Try to get response from server API
            const response = await fetch('/api/chatbot/clear', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.loadChatHistory();
                const chatContainerContent = document.getElementById('chatContainerContent');
                chatContainerContent.style.display = 'none';
            } else {
                console.error("Failed to clear chat:", response.status);
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }
}

/**
 * Initialize chatbot when DOM is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ChatBot();
});