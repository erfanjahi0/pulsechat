/**
 * PulseChat - Profile Page Entry Point
 * Handle profile settings
 */

import {
    onAuthChange,
    getUserProfile,
    updateUserProfile,
    signOut
} from './modules/auth-service.js';

import {
    showToast,
    showError,
    setButtonLoading
} from './modules/ui-renderer.js';

import {
    validateDisplayName,
    redirectTo
} from './modules/utils.js';

// ============================================
// State
// ============================================

let currentUser = null;

// ============================================
// Initialize
// ============================================

// Check authentication
onAuthChange(async (user) => {
    if (!user) {
        redirectTo('index.html');
        return;
    }

    // Load user profile
    currentUser = await getUserProfile(user.uid);

    if (!currentUser) {
        // Create profile if doesn't exist
        currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'User',
            photoURL: user.photoURL
        };
    }

    // Populate form
    populateProfileForm();
});

// ============================================
// DOM Elements
// ============================================

const profileForm = document.getElementById('profile-form');
const logoutBtn = document.getElementById('logout-btn');
const displayNameInput = document.getElementById('displayName');
const emailInput = document.getElementById('email');
const submitBtn = profileForm?.querySelector('button[type="submit"]');

// ============================================
// Event Listeners
// ============================================

// Profile form submission
if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
}

// Logout button
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// ============================================
// Functions
// ============================================

/**
 * Populate profile form with user data
 */
function populateProfileForm() {
    if (displayNameInput) {
        displayNameInput.value = currentUser?.displayName || '';
    }

    if (emailInput) {
        emailInput.value = currentUser?.email || '';
    }
}

/**
 * Handle profile update
 * @param {Event} e
 */
async function handleProfileUpdate(e) {
    e.preventDefault();

    if (!displayNameInput) return;

    const displayName = displayNameInput.value.trim();

    // Validate display name
    const validation = validateDisplayName(displayName);
    if (!validation.valid) {
        showError(validation.message);
        return;
    }

    setButtonLoading(submitBtn, true);

    try {
        await updateUserProfile(currentUser.uid, { displayName });

        currentUser.displayName = displayName;

        showToast('Profile updated successfully', 'success');
    } catch (error) {
        showError(error.message || 'Failed to update profile');
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    try {
        await signOut();
        redirectTo('index.html');
    } catch (error) {
        showToast('Failed to log out', 'error');
        console.error('Error logging out:', error);
    }
}
