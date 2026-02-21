const connectDB = require('../database/connection');
const Chatbot = require('../models/Chatbot');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');

class CleanupService {
    constructor() {
        this.tempPath = path.join(__dirname, '../storage/temp');
    }

    async cleanupTempFiles() {
        try {
            console.log(`[${new Date().toISOString()}] Starting temp files cleanup...`);
            try {
                await fs.access(this.tempPath);
            } catch (error) {
                console.log('Temp directory does not exist, creating it...');
                await fs.mkdir(this.tempPath, { recursive: true });
                return;
            }

            const files = await fs.readdir(this.tempPath);
            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.tempPath, file);
                try {
                    // Check if it's a file (not a directory)
                    const stats = await fs.stat(filePath);
                    if (stats.isFile()) {
                        await fs.unlink(filePath);
                        console.log(`Deleted: ${file}`);
                        deletedCount++;
                    } else {
                        // If it's a directory, you might want to delete it recursively
                        // For now, skip directories
                        console.log(`Skipping directory: ${file}`);
                    }
                } catch (error) {
                    console.error(`Error deleting ${file}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async cleanupChatbotMessages() {
        try {
            await connectDB();
            const result = await Chatbot.deleteMany({});
            console.log(`[${new Date().toISOString()}] Deleted ${result.deletedCount} chatbot messages from database.`);
        } catch (error) {
            console.error('Error deleting chatbot messages:', error);
        }
    }

    scheduleCleanup() {
        // Schedule cleanup every day at 11:00 PM
        // cron format: minute hour day month day-of-week
        cron.schedule('15 03 * * *', async () => {
            console.log(`[${new Date().toISOString()}] Running scheduled cleanup...`);
            await this.cleanupTempFiles();
            await this.cleanupChatbotMessages();
        });

        // Run every 6 hours
        cron.schedule('0 */6 * * *', async () => {
            global.globalSessionVersion = Date.now();
            console.log('All active sessions invalidated.');
        });
    }
}

module.exports = new CleanupService();