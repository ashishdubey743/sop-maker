/**
 * ChatBot class.
 */
class ChatBot {
    /**
     * Constructor.
     */
    constructor() {
        this.initializeEventListeners();
        this.addWelcomeMessage();
    }
    
    /**
     * Initialize event listeners.
     */
    initializeEventListeners() {
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        document.querySelector('button[onclick="chatbot.sendMessage()"]').onclick = () => this.sendMessage();
    }
    
    /**
     * Add welcome message.
     */
    addWelcomeMessage() {
        this.addMessage("Hello! 👋 I'm your AI assistant. How can I help you today? You can ask me anything about coding, technology, or general knowledge!", 'bot');
    }
    
    /**
     * Send message to chatbot.
     */
    sendMessage() {
        const input = document.getElementById('messageInput');
        const message = input.value.trim();
        
        if (message === '') return;
        
        this.addMessage(message, 'user');
        input.value = '';
        
        this.showTypingIndicator();
        
        // Use API endpoint or local response
        this.getBotResponse(message).then(response => {
            this.hideTypingIndicator();
            this.addMessage(response, 'bot');
        });
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
                return data.reply;
            }
        } catch (error) {
            console.log('Using local responses:', error);
        }
    }
    
    /**
     * Show typing indicator.
     */
    showTypingIndicator() {
        const chatContainer = document.getElementById('chatContainer');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'message mb-6';
        typingDiv.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-robot text-white text-sm"></i>
                </div>
                <div class="bg-blue-50 rounded-2xl rounded-tl-none px-4 py-3">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        chatContainer.appendChild(typingDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    /**
     * Hide typing indicator.
     */
    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    /**
     * Add message to chat container.
     */
    addMessage(text, sender) {
        const chatContainer = document.getElementById('chatContainer');
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
}

/**
 * Initialize chatbot when DOM is loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ChatBot();
});