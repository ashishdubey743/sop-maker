require('module-alias/register');
require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('@database/connection');
const cleanupService = require('@services/CleanupService');
const session = require('express-session');
const crypto = require('crypto');
const routes = require('@routes');

cleanupService.scheduleCleanup();
connectDB();

/**
 * Middlewares
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

/**
 * Routes
 */
app.use('/', routes);

/**
 * Start the server.
 */
app.listen(3000, '0.0.0.0', () => {
    console.log('Server is running on http://localhost:3000');
});