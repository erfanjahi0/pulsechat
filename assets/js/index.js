/**
 * index.js — PulseChat v3 (login/register page)
 */

import { onAuthChange, registerWithEmail, loginWithEmail, signInWithGoogle } from './modules/auth-service.js';
import { switchAuthTab, showError, hideError, setButtonLoading, showToast } from './modules/ui-renderer.js';
import { isValidEmail, redirectTo } from './modules/utils.js';

// Apply saved theme
document.documentElement.setAttribute('data-theme', localStorage.getItem('pulsechat-theme') || 'light');

// If already logged in, go straight to app
onAuthChange((profile) => { if (profile) redirectTo('app.html'); });

let currentTab = 'signin';

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        switchAuthTab(currentTab);
        hideError();
    });
});

// Username live clean
document.getElementById('username')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
});

// Form submit
document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email    = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const btn      = document.getElementById('submit-btn');

    if (!email || !isValidEmail(email)) { showError('Please enter a valid email.'); return; }
    if (!password || password.length < 6) { showError('Password must be at least 6 characters.'); return; }

    setButtonLoading(btn, true);

    if (currentTab === 'signin') {
        try {
            await loginWithEmail(email, password);
            // onAuthChange handles redirect
        } catch (err) {
            showError(err.message);
            setButtonLoading(btn, false);
        }
    } else {
        const displayName = document.getElementById('displayName')?.value?.trim();
        const username    = document.getElementById('username')?.value?.trim();
        const confirm     = document.getElementById('confirmPassword')?.value;

        if (!displayName || displayName.length < 2) { showError('Please enter your display name (min 2 chars).'); setButtonLoading(btn, false); return; }
        if (password !== confirm) { showError('Passwords do not match.'); setButtonLoading(btn, false); return; }

        try {
            await registerWithEmail(email, password, displayName, username);
            showToast('Account created! Welcome 🎉', 'success');
            // onAuthChange handles redirect
        } catch (err) {
            showError(err.message);
            setButtonLoading(btn, false);
        }
    }
});

// Google sign-in
document.getElementById('google-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('google-btn');
    setButtonLoading(btn, true);
    try {
        await signInWithGoogle();
        // Browser redirects away — keep button in loading state
    } catch (err) {
        showError(err.message);
        setButtonLoading(btn, false);
    }
});
