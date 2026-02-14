const crypto = require('crypto');
const { generateCodeVerifier } = require("arctic");
const googleAuth = require('@config/googleAuth');
const User = require('@models/User');

exports.googleLogin = async (req, res) => {
    try {
        const state = crypto.randomBytes(16).toString('hex');
        const codeVerifier = generateCodeVerifier();
        const scopes = ['profile', 'email'];

        const authorizationURL = await googleAuth.createAuthorizationURL(
            state,
            codeVerifier,
            scopes
        );

        req.session.oauthState = state;
        req.session.codeVerifier = codeVerifier;

        await req.session.save();

        res.redirect(authorizationURL.toString());

    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Failed to initiate Google login' });
    }
};

exports.googleCallback = async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!req.session.oauthState || state !== req.session.oauthState) {
            return res.status(400).send('Invalid state parameter');
        }

        const tokens = await googleAuth.validateAuthorizationCode(
            code,
            req.session.codeVerifier
        );

        const accessToken = tokens.accessToken();

        const googleResponse = await fetch(
            process.env.GOOGLE_INFO_BASE_URL,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        const googleUser = await googleResponse.json();

        let user = await User.findOne({ email: googleUser.email });

        if (!user) {
            user = await User.create({
                googleId: googleUser.sub,
                email: googleUser.email,
                name: googleUser.name,
                picture: googleUser.picture,
                emailVerified: googleUser.email_verified === true
            });
        } else {
            user.googleId = googleUser.sub;
            user.name = googleUser.name;
            user.picture = googleUser.picture;
            user.lastLogin = new Date();
            await user.save();
        }

        req.session.userId = user._id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        await req.session.save();
        console.log("User Authenticated");
        res.redirect('/index.html');

    } catch (error) {
        console.error('Google callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
};

exports.getCurrentUser = (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName,
        role: req.session.userRole
    });
};
