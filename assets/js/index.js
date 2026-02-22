/**
 * PulseChat - Auth Page Entry Point
 * Handle authentication UI and logic
 */

import {
    onAuthChange,
    registerWithEmail,
    loginWithEmail,
    signInWithGoogle
} from './modules/auth-service.js';

import {
    switchAuthTab,
    showError,
    hideError,
    setButtonLoading,
    showToast
} from './modules/ui-renderer.js';

import {
    isValidEmail,
    validatePassword,
    validateDisplayName,
    isMobile,
    redirectTo
} from './modules/utils.js';

// ============================================
// Initialize
// ============================================

// Check if already authenticated
onAuthChange((user) => {
    if (user) {
        redirectTo('app.html');
    }
});

// ============================================
// DOM Elements
// ============================================

const authForm = document.getElementById('auth-form');
const authTabs = document.querySelectorAll('.auth-tab');
const googleBtn = document.getElementById('google-btn');
const submitBtn = document.getElementById('submit-btn');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const displayNameInput = document.getElementById('displayName');
const confirmPasswordInput = document.getElementById('confirmPassword');

let currentTab = 'signin';

// ============================================
// Event Listeners
// ============================================

// Tab switching
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        switchAuthTab(currentTab);
        hideError();
    });
});

// Form submission
if (authForm) {
    authForm.addEventListener('submit', handleFormSubmit);
}

// Google sign-in
if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
}

// Real-time validation
if (emailInput) {
    emailInput.addEventListener('input', hideError);
}

if (passwordInput) {
    passwordInput.addEventListener('input', hideError);
}

// ============================================
// Handlers
// ============================================

/**
 * Handle form submission
 * @param {Event} e
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    hideError();

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';
    const displayName = displayNameInput?.value?.trim() || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    // Validate inputs
    if (!email || !password) {
        showError('Please fill in all required fields');
        return;
    }

    if (!isValidEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }

    if (currentTab === 'register') {
        // Validate display name
        const nameValidation = validateDisplayName(displayName);
        if (!nameValidation.valid) {
            showError(nameValidation.message);
            return;
        }

        // Validate password
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            showError(passwordValidation.message);
            return;
        }

        // Check password match
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        // Register new user
        await handleRegistration(email, password, displayName);
    } else {
        // Login
        await handleLogin(email, password);
    }
}

/**
 * Handle email registration
 * @param {string} email
 * @param {string} password
 * @param {string} displayName
 */
async function handleRegistration(email, password, displayName) {
    setButtonLoading(submitBtn, true);

    try {
        await registerWithEmail(email, password, displayName);
        showToast('Account created successfully!', 'success');
        redirectTo('app.html');
    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle email login
 * @param {string} email
 * @param {string} password
 */
async function handleLogin(email, password) {
    setButtonLoading(submitBtn, true);

    try {
        await loginWithEmail(email, password);
        showToast('Welcome back!', 'success');
        redirectTo('app.html');
    } catch (error) {
        showError(error.message);
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle Google sign-in
 */
async function handleGoogleSignIn() {
    setButtonLoading(googleBtn, true);

    try {
        await signInWithGoogle(isMobile());
        showToast('Signed in successfully!', 'success');
        redirectTo('app.html');
    } catch (error) {
        // If popup was closed, don't show error
        if (error.code !== 'auth/popup-closed-by-user') {
            showError(error.message);
        }
    } finally {
        setButtonLoading(googleBtn, false);
    }
}
