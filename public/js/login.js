if (localStorage.getItem('cleanupAlertShown')) {
    localStorage.removeItem('cleanupAlertShown');
}
/**
 *  Check if user already logged in.
 */
async function checkAuth() {
    try {
        const response = await fetch('/auth/me');
        if (response.ok) {
            const user = await response.json();
            showUserInfo(user);
            // Redirect to main page if authenticated
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }
    } catch (error) {
        // Not authenticated, stay on login page
        console.log('Not authenticated');
    }
}

/**
 * Helper function to hit google auth route.
 */
function loginWithGoogle() {
    window.location.href = '/auth/google';
}

/**
 * Logout current user.
 */
async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
        hideUserInfo();
        showSuccess('Successfully logged out');
    } catch (error) {
        showError('Logout failed. Please try again.');
    }
}

/**
 * Show current user information.
 */
function showUserInfo(user) {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userName').textContent = user.email || user.name;
    showSuccess(`Welcome, ${user.name || user.email}! Redirecting...`);
}

/**
 * Hide current user information.
 */
function hideUserInfo() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('userInfo').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
}

/**
 * Helper function to show error.
 */
function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    errorEl.classList.add('block');
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000);
}

/**
 * SHelper function to show success message while login.
 */
function showSuccess(message) {
    const errorEl = document.getElementById('error');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden', 'text-red-500');
    errorEl.classList.add('block', 'text-green-500');
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 3000);
}

// Check auth status on page load
checkAuth();