/**
 * PulseChat v2 - Profile Page
 * FIXES:
 *  - All handlers guard currentUser != null (was throwing uid on null)
 *  - Theme toggle wired properly
 * NEW:
 *  - Password change (requires current password verification)
 */

import {
    onAuthChange, getUserProfile,
    updateUserProfile, updateUsername,
    uploadProfilePicture, updatePassword, signOut
} from './modules/auth-service.js';
import { showToast, showError, setButtonLoading } from './modules/ui-renderer.js';
import { validateDisplayName, redirectTo } from './modules/utils.js';

let currentUser = null;

// ── Theme sync ────────────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem('pulsechat-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Auth gate ─────────────────────────────────────────────────────────────────

onAuthChange(async (user) => {
    if (!user) { redirectTo('index.html'); return; }

    currentUser = await getUserProfile(user.id);
    if (!currentUser) {
        currentUser = {
            uid: user.id, id: user.id,
            email: user.email,
            displayName: user.user_metadata?.full_name || 'User',
            username: null, photoURL: user.user_metadata?.avatar_url || null,
            authProvider: user.app_metadata?.provider || 'password'
        };
    }

    populateForm();
    renderAvatar();
    renderCooldownInfo();

    // Hide password section for OAuth users (they have no password to change)
    const pwSection = document.getElementById('password-section');
    if (pwSection && currentUser.authProvider !== 'password') {
        pwSection.style.display = 'none';
    }
});

// ── DOM refs ──────────────────────────────────────────────────────────────────

const profileForm    = document.getElementById('profile-form');
const usernameForm   = document.getElementById('username-form');
const passwordForm   = document.getElementById('password-form');
const avatarInput    = document.getElementById('avatar-input');
const avatarBtn      = document.getElementById('avatar-btn');
const logoutBtn      = document.getElementById('logout-btn');

// ── Populate ──────────────────────────────────────────────────────────────────

function populateForm() {
    const nameEl     = document.getElementById('displayName');
    const emailEl    = document.getElementById('email');
    const usernameEl = document.getElementById('username');

    if (nameEl)     nameEl.value     = currentUser?.displayName || '';
    if (emailEl)    emailEl.value    = currentUser?.email || '';
    if (usernameEl) usernameEl.value = currentUser?.username || '';
}

function renderAvatar() {
    const avatarEl = document.getElementById('profile-avatar');
    if (!avatarEl) return;

    if (currentUser?.photoURL) {
        avatarEl.innerHTML = `<img src="${currentUser.photoURL}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
        avatarEl.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
    }
}

function renderCooldownInfo() {
    const usernameInfo = document.getElementById('username-cooldown-info');
    const avatarInfo   = document.getElementById('avatar-cooldown-info');

    if (currentUser?.usernameChangedAt && usernameInfo) {
        const days = (Date.now() - new Date(currentUser.usernameChangedAt).getTime()) / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            usernameInfo.textContent = `You can change your username again in ${remaining} day${remaining > 1 ? 's' : ''}.`;
            usernameInfo.style.color = 'var(--color-warning)';
            document.getElementById('username')?.setAttribute('disabled', 'true');
            usernameForm?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'true');
        } else {
            usernameInfo.textContent = 'You can change your username once per week.';
            usernameInfo.style.color = '';
        }
    }

    if (currentUser?.photoChangedAt && avatarInfo) {
        const days = (Date.now() - new Date(currentUser.photoChangedAt).getTime()) / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            avatarInfo.textContent = `You can change your photo again in ${remaining} day${remaining > 1 ? 's' : ''}.`;
            avatarInfo.style.color = 'var(--color-warning)';
            avatarBtn?.setAttribute('disabled', 'true');
        } else {
            avatarInfo.textContent = 'You can change your photo once per week.';
            avatarInfo.style.color = '';
        }
    }
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

avatarBtn?.addEventListener('click', () => avatarInput?.click());

avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // FIX: guard null currentUser
    if (!currentUser) { showToast('Not logged in.', 'error'); return; }

    avatarBtn.disabled = true;
    avatarBtn.textContent = 'Uploading…';

    try {
        const result = await uploadProfilePicture(currentUser.uid, file);
        currentUser.photoURL = result.photoURL;
        renderAvatar();
        renderCooldownInfo();
        showToast('Profile picture updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        avatarBtn.disabled = false;
        avatarBtn.textContent = 'Change Photo';
        avatarInput.value = '';
    }
});

// ── Display name form ─────────────────────────────────────────────────────────

profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // FIX: guard null currentUser
    if (!currentUser) { showToast('Not logged in. Please refresh.', 'error'); return; }

    const displayName = document.getElementById('displayName')?.value?.trim();
    const validation  = validateDisplayName(displayName);
    if (!validation.valid) { showError(validation.message); return; }

    const submitBtn = profileForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);

    try {
        await updateUserProfile(currentUser.uid, { displayName });
        currentUser.displayName = displayName;
        showToast('Display name updated!', 'success');
    } catch (err) {
        showError(err.message || 'Failed to update. Please try again.');
    } finally {
        setButtonLoading(submitBtn, false);
    }
});

// ── Username form ─────────────────────────────────────────────────────────────

usernameForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // FIX: guard null currentUser
    if (!currentUser) { showToast('Not logged in. Please refresh.', 'error'); return; }

    const username = document.getElementById('username')?.value?.trim();
    if (!username) { showToast('Please enter a username.', 'error'); return; }

    const submitBtn = usernameForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);

    try {
        const result = await updateUsername(currentUser.uid, username);
        currentUser.username         = result.username;
        currentUser.usernameChangedAt = new Date().toISOString();
        renderCooldownInfo();
        showToast(`Username set to @${result.username}!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
});

// ── Username live sanitisation ────────────────────────────────────────────────

document.getElementById('username')?.addEventListener('input', (e) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    e.target.value = clean;
});

// ── Password change form ──────────────────────────────────────────────────────

passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // FIX: guard null currentUser
    if (!currentUser) { showToast('Not logged in. Please refresh.', 'error'); return; }

    const oldPassword     = document.getElementById('old-password')?.value;
    const newPassword     = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-new-password')?.value;

    if (!oldPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all password fields.', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('New password must be at least 6 characters.', 'error');
        return;
    }

    const submitBtn = passwordForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);

    try {
        await updatePassword(currentUser.email, oldPassword, newPassword);
        // Clear fields on success
        document.getElementById('old-password').value         = '';
        document.getElementById('new-password').value         = '';
        document.getElementById('confirm-new-password').value = '';
        showToast('Password changed successfully!', 'success');
    } catch (err) {
        showToast(err.message || 'Failed to change password.', 'error');
    } finally {
        setButtonLoading(submitBtn, false);
    }
});

// ── Logout ────────────────────────────────────────────────────────────────────

logoutBtn?.addEventListener('click', async () => {
    try { await signOut(); redirectTo('index.html'); }
    catch (err) { showToast('Failed to log out.', 'error'); }
});
