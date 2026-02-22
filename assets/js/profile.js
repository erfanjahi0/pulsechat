/**
 * profile.js — PulseChat v3 (profile settings page)
 */

import { onAuthChange, updateUserProfile, updateUsername, uploadProfilePicture, changePassword, signOut } from './modules/auth-service.js';
import { showToast, showError, setButtonLoading } from './modules/ui-renderer.js';
import { redirectTo } from './modules/utils.js';

// Theme
document.documentElement.setAttribute('data-theme', localStorage.getItem('pulsechat-theme') || 'light');
document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pulsechat-theme', next);
    const tv = document.getElementById('theme-value');
    if (tv) tv.textContent = next === 'dark' ? 'Dark' : 'Light';
});

// Set initial theme label
const tv = document.getElementById('theme-value');
if (tv) tv.textContent = (localStorage.getItem('pulsechat-theme') || 'light') === 'dark' ? 'Dark' : 'Light';

let currentUser = null;

// Auth gate
onAuthChange(async (profile) => {
    if (!profile) { redirectTo('index.html'); return; }
    currentUser = profile;
    populateForm();
    renderAvatar();
    renderCooldowns();
});

function populateForm() {
    const el = (id) => document.getElementById(id);
    if (el('displayName')) el('displayName').value = currentUser.displayName || '';
    if (el('email'))       el('email').value       = currentUser.email       || '';
    if (el('username'))    el('username').value    = currentUser.username    || '';
}

function renderAvatar() {
    const av = document.getElementById('profile-avatar');
    if (!av) return;
    av.innerHTML = currentUser.photoURL
        ? `<img src="${currentUser.photoURL}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : `<svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
}

function renderCooldowns() {
    // Username cooldown
    const uInfo = document.getElementById('username-cooldown-info');
    const uInput = document.getElementById('username');
    const uBtn   = document.getElementById('username-submit-btn');
    if (currentUser.usernameChangedAt) {
        const days = (Date.now() - new Date(currentUser.usernameChangedAt).getTime()) / 86400000;
        if (days < 7) {
            const left = Math.ceil(7 - days);
            if (uInfo) { uInfo.textContent = `You can change username again in ${left} day${left !== 1 ? 's' : ''}.`; uInfo.style.color = 'var(--color-warning)'; }
            if (uInput) uInput.disabled = true;
            if (uBtn)   uBtn.disabled   = true;
            return;
        }
    }
    if (uInfo) { uInfo.textContent = 'Can be changed once per week.'; uInfo.style.color = ''; }

    // Photo cooldown
    const pInfo = document.getElementById('avatar-cooldown-info');
    const pBtn  = document.getElementById('avatar-btn');
    if (currentUser.photoChangedAt) {
        const days = (Date.now() - new Date(currentUser.photoChangedAt).getTime()) / 86400000;
        if (days < 7) {
            const left = Math.ceil(7 - days);
            if (pInfo) { pInfo.textContent = `You can change photo again in ${left} day${left !== 1 ? 's' : ''}.`; pInfo.style.color = 'var(--color-warning)'; }
            if (pBtn)  pBtn.disabled = true;
            return;
        }
    }
    if (pInfo) { pInfo.textContent = 'Can be changed once per week.'; pInfo.style.color = ''; }
}

// ── Display Name ──────────────────────────────────────────────────────────────

document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const displayName = document.getElementById('displayName')?.value?.trim();
    if (!displayName || displayName.length < 2) { showError('Name must be at least 2 characters.'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);
    try {
        await updateUserProfile(currentUser.uid, { displayName });
        currentUser.displayName = displayName;
        showToast('Name updated!', 'success');
    } catch (err) {
        showError(err.message);
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── Username ──────────────────────────────────────────────────────────────────

document.getElementById('username')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
});

document.getElementById('username-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const username = document.getElementById('username')?.value?.trim();
    if (!username) { showToast('Please enter a username.', 'error'); return; }

    const btn = document.getElementById('username-submit-btn');
    setButtonLoading(btn, true);
    try {
        const result = await updateUsername(currentUser.uid, username);
        currentUser.username = result.username;
        currentUser.usernameChangedAt = new Date().toISOString();
        renderCooldowns();
        showToast(`@${result.username} is now your username!`, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── Avatar ────────────────────────────────────────────────────────────────────

document.getElementById('avatar-btn')?.addEventListener('click', () => document.getElementById('avatar-input')?.click());

document.getElementById('avatar-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const btn = document.getElementById('avatar-btn');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    try {
        const result = await uploadProfilePicture(currentUser.uid, file);
        currentUser.photoURL = result.photoURL;
        currentUser.photoChangedAt = new Date().toISOString();
        renderAvatar();
        renderCooldowns();
        showToast('Photo updated!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = orig;
        e.target.value = '';
    }
});

// ── Password ──────────────────────────────────────────────────────────────────

document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const np = document.getElementById('new-password')?.value;
    const cp = document.getElementById('confirm-password')?.value;
    if (!np || np.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return; }
    if (np !== cp) { showToast('Passwords do not match.', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(btn, true);
    try {
        await changePassword(np);
        showToast('Password changed!', 'success');
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        setButtonLoading(btn, false);
    }
});

// ── Logout ────────────────────────────────────────────────────────────────────

document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try { await signOut(); redirectTo('index.html'); }
    catch { showToast('Logout failed.', 'error'); }
});
