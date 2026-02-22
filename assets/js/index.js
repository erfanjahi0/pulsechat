/**
 * PulseChat v2 - Auth Page
 * Fixed: Google login, loading loop, username registration
 */

import { onAuthChange, registerWithEmail, loginWithEmail, signInWithGoogle } from './modules/auth-service.js';
import { switchAuthTab, showError, hideError, setButtonLoading, showToast } from './modules/ui-renderer.js';
import { isValidEmail, validatePassword, validateDisplayName, redirectTo } from './modules/utils.js';

// ── Auth gate ─────────────────────────────────────────────────────────────────
// FIX: was calling getUserProfile inside onAuthChange which could loop.
// Now just check user presence and redirect.

onAuthChange((user) => {
    if (user) {
        redirectTo('app.html');
    }
});

// ── DOM ───────────────────────────────────────────────────────────────────────

const authForm          = document.getElementById('auth-form');
const authTabs          = document.querySelectorAll('.auth-tab');
const googleBtn         = document.getElementById('google-btn');
const submitBtn         = document.getElementById('submit-btn');
const emailInput        = document.getElementById('email');
const passwordInput     = document.getElementById('password');
const displayNameInput  = document.getElementById('displayName');
const confirmPassInput  = document.getElementById('confirmPassword');
const usernameInput     = document.getElementById('username');
const usernameHint      = document.getElementById('username-hint');

let currentTab = 'signin';

// ── Tab switching ─────────────────────────────────────────────────────────────

authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        switchAuthTab(currentTab);
        hideError();
    });
});

// ── Username live validation ──────────────────────────────────────────────────

if (usernameInput) {
    usernameInput.addEventListener('input', () => {
        const val = usernameInput.value;
        const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (val !== clean) usernameInput.value = clean;

        if (clean.length === 0) {
            usernameHint.textContent = '';
        } else if (clean.length < 3) {
            usernameHint.style.color = 'var(--color-error)';
            usernameHint.textContent = 'At least 3 characters';
        } else {
            usernameHint.style.color = 'var(--color-success)';
            usernameHint.textContent = `@${clean} looks good!`;
        }
    });
}

// ── Form submit ───────────────────────────────────────────────────────────────

if (authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const email    = emailInput?.value?.trim() || '';
        const password = passwordInput?.value || '';

        if (!email || !password) { showError('Please fill in all required fields.'); return; }
        if (!isValidEmail(email)) { showError('Please enter a valid email address.'); return; }

        if (currentTab === 'register') {
            const displayName    = displayNameInput?.value?.trim() || '';
            const username       = usernameInput?.value?.trim() || '';
            const confirmPass    = confirmPassInput?.value || '';

            const nameValidation = validateDisplayName(displayName);
            if (!nameValidation.valid) { showError(nameValidation.message); return; }

            const passValidation = validatePassword(password);
            if (!passValidation.valid) { showError(passValidation.message); return; }

            if (password !== confirmPass) { showError('Passwords do not match.'); return; }
            if (username && username.length < 3) { showError('Username must be at least 3 characters.'); return; }

            setButtonLoading(submitBtn, true);
            try {
                await registerWithEmail(email, password, displayName, username);
                showToast('Account created! Welcome to PulseChat 🎉', 'success');
                // onAuthChange will handle redirect
            } catch (err) {
                showError(err.message);
                setButtonLoading(submitBtn, false);
            }
        } else {
            setButtonLoading(submitBtn, true);
            try {
                await loginWithEmail(email, password);
                // onAuthChange will handle redirect
            } catch (err) {
                showError(err.message);
                setButtonLoading(submitBtn, false);
            }
        }
    });
}

// ── Google sign-in ────────────────────────────────────────────────────────────
// FIX: removed the broken popup approach, now uses OAuth redirect properly.

if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        setButtonLoading(googleBtn, true);
        try {
            await signInWithGoogle();
            // Page will redirect via OAuth — button stays in loading state intentionally
        } catch (err) {
            showError(err.message);
            setButtonLoading(googleBtn, false);
        }
    });
}

// Clear errors on input
[emailInput, passwordInput].forEach(el => {
    el?.addEventListener('input', hideError);
});
