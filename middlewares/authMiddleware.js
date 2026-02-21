exports.isAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // 🔥 Check session version for global invalidation
    if (req.session.sessionVersion !== global.globalSessionVersion) {
        req.session.destroy(() => {
            return res.status(401).json({ error: 'Session expired. Please login again.' });
        });
        return;
    }

    next();
};