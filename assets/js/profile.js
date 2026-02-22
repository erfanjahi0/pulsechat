/**
 * PulseChat v2 - Profile Page
 * New: username change (weekly), avatar upload (weekly), dark mode sync
 */

import { onAuthChange, getUserProfile, updateUserProfile, updateUsername, uploadProfilePicture, signOut } from './modules/auth-service.js';
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
            username: null, photoURL: user.user_metadata?.avatar_url || null
        };
    }

    populateForm();
    renderAvatar();
    renderCooldownInfo();
});

// ── DOM ───────────────────────────────────────────────────────────────────────

const profileForm    = document.getElementById('profile-form');
const usernameForm   = document.getElementById('username-form');
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
        const last = new Date(currentUser.usernameChangedAt);
        const diff = Date.now() - last.getTime();
        const days = diff / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            usernameInfo.textContent = `You can change your username again in ${remaining} day${remaining > 1 ? 's' : ''}.`;
            usernameInfo.style.color = 'var(--color-warning)';
            document.getElementById('username')?.setAttribute('disabled', 'true');
            usernameForm?.querySelector('button[type="submit"]')?.setAttribute('disabled', 'true');
        } else {
            usernameInfo.textContent = 'You can change your username once per week.';
        }
    }

    if (currentUser?.photoChangedAt && avatarInfo) {
        const last = new Date(currentUser.photoChangedAt);
        const diff = Date.now() - last.getTime();
        const days = diff / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            avatarInfo.textContent = `You can change your photo again in ${remaining} day${remaining > 1 ? 's' : ''}.`;
            avatarInfo.style.color = 'var(--color-warning)';
            avatarBtn?.setAttribute('disabled', 'true');
        } else {
            avatarInfo.textContent = 'You can change your photo once per week.';
        }
    }
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

avatarBtn?.addEventListener('click', () => avatarInput?.click());

avatarInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    const username  = document.getElementById('username')?.value?.trim();
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

// ── Username live validation ──────────────────────────────────────────────────

document.getElementById('username')?.addEventListener('input', (e) => {
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    e.target.value = clean;
});

// ── Logout ────────────────────────────────────────────────────────────────────

logoutBtn?.addEventListener('click', async () => {
    try { await signOut(); redirectTo('index.html'); }
    catch (err) { showToast('Failed to log out.', 'error'); }
});
