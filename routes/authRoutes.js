const express = require('express');
const router = express.Router();
const authController = require('@controllers/AuthController');

router.get('/google', authController.googleLogin);
router.get('/google/callback', authController.googleCallback);
router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);

module.exports = router;