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
        this.initializeMagicSOPButton();
        this.loading = false;
    }

    /**
     * Initialize magic SOP icon click handler
     */
    initializeMagicSOPButton() {
        const magicBtn = document.getElementById('magicSOPButton');
        const input = document.getElementById('messageInput');
        if (magicBtn && input) {
            magicBtn.onclick = async () => {
                const userText = input.value.trim();
                if (!userText) return;
                magicBtn.disabled = true;
                magicBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                try {
                    // Call backend to convert to SOP query
                    const resp = await fetch('/api/magic-sop', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: userText })
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        input.value = data.sopQuery || userText;
                    } else {
                        input.value = userText;
                    }
                } catch (err) {
                    input.value = userText;
                }
                magicBtn.disabled = false;
                magicBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles text-lg"></i>';
            };
        }
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
                const clearChatButton = document.getElementById('clearChat');
                const messages = await response.json();

                if (messages.length > 0) {
                    emptyState.style.display = 'none';
                    clearChatButton.style.display = 'block';
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
                    clearChatButton.style.display = 'none';
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
        if (!emptyState) return;

        const block = document.getElementById('suggestionsBlock');
        const list = document.getElementById('suggestionsList');
        const template = document.getElementById('suggestionTemplate');
        if (!block || !list || !template) return;

        // Clear any existing suggestion nodes
        list.innerHTML = '';
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
     * Validate user input before sending to chatbot.
     */
    validateInput = () => {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendButton');
        const magicSOPButton = document.getElementById('magicSOPButton');
        const validation = document.getElementById('inputValidation');
        const text = input.value.trim();
        const minLength = 10;
        const isValidLength = text.length >= minLength;

        if (!isValidLength) {
            validation.classList.remove('hidden');
            sendBtn.disabled = true;
            magicSOPButton.disabled = true;
            return false;
        }

        validation.classList.add('hidden');
        sendBtn.disabled = false;
        magicSOPButton.disabled = false;
        return true;
    };

    /**
     * Initialize event listeners.
     */
    initializeEventListeners() {
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendButton');
        const maximizeBtn = document.getElementById('maximizeInputBtn');

        /**
         * Maximize the input area for better readability.
         */
        if (maximizeBtn && input) {
            maximizeBtn.addEventListener('click', () => {
                if (!input.classList.contains('maximized')) {
                    input.style.maxHeight = '500px';
                    input.style.height = '500px';
                    input.classList.add('maximized');
                    maximizeBtn.innerHTML = '<i class="fas fa-compress"></i>';
                    maximizeBtn.title = 'Shrink input area';
                } else {
                    input.style.maxHeight = '160px';
                    input.style.height = '';
                    input.classList.remove('maximized');
                    maximizeBtn.innerHTML = '<i class="fas fa-expand"></i>';
                    maximizeBtn.title = 'Expand input area';
                }
            });
        }
        input.addEventListener('input', this.validateInput);

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (this.validateInput()) {
                    this.sendMessage();
                }
            }
        });

        sendBtn.onclick = () => {
            if (this.validateInput()) {
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
        // Ensure chat container is visible after clear
        const chatContainerContent = document.getElementById('chatContainerContent');
        if (chatContainerContent) {
            chatContainerContent.style.display = 'block';
        }
        this.addMessage(message, 'user');
        // Save user message and get the document ID
        this.saveMessageInDatabase({
            message: message,
            role: 'user',
            session: this.getCurrentSession() // You'll need to track sessions
        }).then(documentId => {
            // Store the document ID for updating later
            this.lastMessageId = documentId;
            document.getElementById('magicSOPButton').disabled = true;
            document.getElementById('sendButton').disabled = true;
            document.getElementById('clearChat').style.display = 'block';
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

            // Ensure chat container is visible before adding bot message
            if (chatContainerContent) {
                chatContainerContent.style.display = 'block';
            }
            this.addMessage(botResponse, 'bot', docPath);
        });
    }

    /**
     * Save message in database.
     */
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

    /**
     * Helper function to add answer to the question in database.
     */
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

    /**
     * Get current session.
     */
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
    getBotResponse(message) {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        style: 'standard'
                    })
                });

                if (!response.body) {
                    return reject("No response body");
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (let line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.replace('data: ', '').trim();

                            if (!jsonStr) continue;

                            try {
                                const parsed = JSON.parse(jsonStr);

                                if (parsed.heading) {
                                    const el = document.getElementById('loadingMessage');
                                    if (el) el.textContent = parsed.heading;
                                }

                                if (parsed.done) {
                                    fullResponse = parsed.response;
                                    var docPath = parsed.docPath;
                                }

                                if (parsed.error) {
                                    return reject(parsed.error);
                                }

                            } catch (err) {
                                // ignore partial JSON
                            }
                        }
                    }
                }

                resolve({
                    botResponse: fullResponse,
                    docPath: docPath
                });

            } catch (error) {
                reject(error);
            }
        });
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
                <span id="loadingMessage" class="font-bold text-lg text-black">Thinking...</span>
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
                if (chatContainerContent) {
                    chatContainerContent.innerHTML = '';
                    chatContainerContent.style.display = 'none';
                }
            } else {
                console.error("Failed to clear chat:", response.status);
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
        }
    }

    /**
     * Check Authentication.
     */
    async checkAuth() {
        try {
            const response = await fetch('/auth/me');
            if (!response.ok) {
                window.location.href = '/login.html';
                return null;
            }
            return await response.json();
        } catch (error) {
            window.location.href = '/login.html';
            return null;
        }
    }

    /**
     * Logout user.
     */
    async logout() {
        localStorage.removeItem('cleanupNotificationShown');
        await fetch('/auth/logout', { method: 'POST' });
        window.location.href = '/index.html';
    }

    /**
     * Open delete modal.
     */
    openDeleteModal() {
        document.getElementById('deleteConfirmationModal').classList.remove('hidden');
    }

    /**
     * Close delete modal.
     */
    closeDeleteModal() {
        document.getElementById('deleteConfirmationModal').classList.add('hidden');
    }

    /**
     * Confirm deletion.
     */
    confirmDelete() {
        chatbot.closeDeleteModal();
        chatbot.clearChat();
    }
}

/**
 * Initialize chatbot when DOM is loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
    window.chatbot = new ChatBot();

    // Show cleanup notification every login
    const popup = document.getElementById('cleanupNotification');
    const closeBtn = document.getElementById('closeCleanupNotification');
    if (popup && closeBtn) {
        if (!localStorage.getItem('cleanupAlertShown')) {
            popup.classList.remove('hidden');
            localStorage.setItem('cleanupAlertShown', 'true');
        }
        closeBtn.onclick = () => {
            popup.classList.add('hidden');
        };
    }

    const user = await chatbot.checkAuth();
    if (user) {
        const menuButton = document.createElement('button');
        menuButton.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        menuButton.setAttribute('style', 'position: fixed; top: 15px; right: 15px; background: white; border: none; padding: 10px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; z-index: 1000; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;');
        menuButton.setAttribute('id', 'userMenuButton');

        const dropdown = document.createElement('div');
        dropdown.setAttribute('id', 'userDropdown');
        dropdown.setAttribute('style', 'position: fixed; top: 65px; right: 15px; background: white; padding: 12px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); min-width: 180px; z-index: 1001; display: none;');
        dropdown.innerHTML = `
                    <div style="padding: 8px; border-bottom: 1px solid #eee; margin-bottom: 8px; font-weight: 600; color: #333;">
                        ${user.name || user.email}
                    </div>
                    <button onclick="chatbot.logout()" style="display: block; width: 100%; text-align: left; background: none; border: none; padding: 8px; color: #ff4444; cursor: pointer; border-radius: 6px; font-size: 14px;">
                        Logout
                    </button>
                `;

        document.body.appendChild(menuButton);
        document.body.appendChild(dropdown);

        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            dropdown.style.display = 'none';
        });
    }
});