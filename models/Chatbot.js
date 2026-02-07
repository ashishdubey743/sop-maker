const mongoose = require('mongoose');

const chatbotSchema = new mongoose.Schema(
    {
        question: { type: String, required: true },
        answer: { type: String, default: '' },
        docPath: { type: String, default: ''},
        is_expired: { type: Boolean, default: false },
        session: { type: String, required: true }
      },
      {
        timestamps: {
          createdAt: 'created_at',
          updatedAt: 'updated_at'
        }
      }
);

module.exports = mongoose.model('Chatbot', chatbotSchema);