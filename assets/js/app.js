/**
 * app.js — PulseChat v3
 *
 * FIXES vs v2:
 * - Removed dynamic import() of updateUserProfile (was causing silent failure)
 * - currentUser is now the resolved DB profile object (always has .uid)
 * - Auth callback only fires once per real state change
 * - All modal/profile/search handlers now guard against null currentUser
 * - Added password change in profile modal
 * - Dark mode toggle works
 */

import { onAuthChange, updateUserProfile, changePassword, updateLastSeen, signOut } from './modules/auth-service.js';
import { subscribeToChatList, searchUsers, getOrCreateChat, subscribeToMessages, markChatAsRead, sendMessage, getUserById } from './modules/db-service.js';
import { updateCurrentUserDisplay, renderChatList, clearChatListLoading, renderMessages, clearMessagesLoading, showChatArea, hideChatArea, setSendButtonEnabled, clearMessageInput, showModal, hideModal, showToast } from './modules/ui-renderer.js';
import { debounce, redirectTo, autoResizeTextarea, escapeHtml } from './modules/utils.js';

// ── State ─────────────────────────────────────────────────────────────────────

let currentUser        = null;
let currentChatId      = null;
let currentOtherUserId = null;
let unsubChats         = null;
let unsubMessages      = null;

// ── Theme ─────────────────────────────────────────────────────────────────────

const applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('pulsechat-theme', t);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.innerHTML = t === 'dark'
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
};
applyTheme(localStorage.getItem('pulsechat-theme') || 'light');

// ── Auth ──────────────────────────────────────────────────────────────────────

// If not logged in after 10 s, go to login page
const authTimeout = setTimeout(() => { if (!currentUser) redirectTo('index.html'); }, 10000);

onAuthChange((profile) => {
    clearTimeout(authTimeout);
    if (!profile) { redirectTo('index.html'); return; }

    // Only initialise once
    if (currentUser?.uid === profile.uid) return;
    currentUser = profile;

    updateCurrentUserDisplay(currentUser);
    updateLastSeen(currentUser.uid);
    initChatList();
    setInterval(() => currentUser && updateLastSeen(currentUser.uid), 60000);
});

// ── DOM ───────────────────────────────────────────────────────────────────────

const $  = (id) => document.getElementById(id);
const messageInput     = $('message-input');
const messageForm      = $('message-form');
const userSearch       = $('user-search');
const searchClear      = $('search-clear');
const newChatSearch    = $('new-chat-search');

document.getElementById('theme-toggle')  ?.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
document.getElementById('new-chat-btn') ?.addEventListener('click', () => { newChatSearch.value = ''; $('new-chat-results').innerHTML = '<p class="search-hint">Type a username or email to search</p>'; showModal('new-chat-modal'); });
document.getElementById('btn-back')     ?.addEventListener('click', handleBack);
document.getElementById('logout-btn')   ?.addEventListener('click', handleLogout);
document.getElementById('close-profile-modal') ?.addEventListener('click', () => hideModal('profile-modal'));
document.getElementById('close-new-chat-modal')?.addEventListener('click', () => hideModal('new-chat-modal'));
document.getElementById('profile-modal')       ?.addEventListener('click', (e) => { if (e.target.id === 'profile-modal') hideModal('profile-modal'); });
document.getElementById('new-chat-modal')      ?.addEventListener('click', (e) => { if (e.target.id === 'new-chat-modal') hideModal('new-chat-modal'); });
document.getElementById('user-profile-trigger')?.addEventListener('click', openProfileModal);
document.getElementById('profile-form')        ?.addEventListener('submit', handleSaveName);
document.getElementById('password-form')       ?.addEventListener('submit', handleChangePassword);

// ── Messaging ─────────────────────────────────────────────────────────────────

messageInput?.addEventListener('input', () => {
    setSendButtonEnabled(messageInput.value.trim().length > 0);
    autoResizeTextarea(messageInput);
});

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitMessage(); }
});

messageForm?.addEventListener('submit', (e) => { e.preventDefault(); submitMessage(); });

async function submitMessage() {
    if (!currentChatId || !currentUser || !messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;
    clearMessageInput();
    try {
        await sendMessage(currentChatId, currentUser.uid, currentOtherUserId, text);
    } catch (err) {
        showToast('Failed to send message.', 'error');
        messageInput.value = text; // restore on error
    }
}

// ── Chat list ─────────────────────────────────────────────────────────────────

function initChatList() {
    unsubChats?.();
    unsubChats = subscribeToChatList(currentUser.uid, (chats) => {
        clearChatListLoading();
        renderChatList(chats, currentUser.uid, selectChat);
    });
}

async function selectChat(chatId, otherUserId) {
    unsubMessages?.();
    currentChatId      = chatId;
    currentOtherUserId = otherUserId;

    const other = await getUserById(otherUserId);
    showChatArea(other);
    $('messages-list').innerHTML = '';
    clearMessagesLoading();
    markChatAsRead(chatId, currentUser.uid);

    unsubMessages = subscribeToMessages(chatId, (msgs) => {
        clearMessagesLoading();
        renderMessages(msgs, currentUser.uid);
    });
}

function handleBack() {
    unsubMessages?.();
    unsubMessages = null;
    currentChatId = currentOtherUserId = null;
    hideChatArea();
    const ml = $('messages-list');
    if (ml) ml.innerHTML = '';
}

// ── User Search (sidebar) ─────────────────────────────────────────────────────

userSearch?.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    searchClear?.classList.toggle('hidden', !q);
    const sr = $('search-results');
    if (!q || q.length < 2) { sr?.classList.add('hidden'); return; }
    if (!currentUser) return;
    const results = await searchUsers(q, currentUser.uid);
    renderUserResults(results, sr, (user) => {
        sr?.classList.add('hidden');
        userSearch.value = '';
        searchClear?.classList.add('hidden');
        startChat(user);
    });
}, 300));

searchClear?.addEventListener('click', () => {
    userSearch.value = '';
    searchClear.classList.add('hidden');
    $('search-results')?.classList.add('hidden');
    userSearch.focus();
});

// ── New Chat Modal Search ─────────────────────────────────────────────────────

newChatSearch?.addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    const el = $('new-chat-results');
    if (!q || q.length < 2) { if(el) el.innerHTML = '<p class="search-hint">Type a username or email to search</p>'; return; }
    if (!currentUser) return;
    const results = await searchUsers(q, currentUser.uid);
    renderUserResults(results, el, (user) => {
        hideModal('new-chat-modal');
        startChat(user);
    });
}, 300));

function renderUserResults(results, container, onSelect) {
    if (!container) return;
    if (results.length === 0) {
        container.innerHTML = '<p class="search-hint">No users found — try email or @username</p>';
        container.classList.remove('hidden');
        return;
    }
    const frag = document.createDocumentFragment();
    results.forEach(user => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="avatar">
                ${user.photoURL
                    ? `<img src="${escapeHtml(user.photoURL)}" alt="">`
                    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`}
            </div>
            <div class="user-info">
                <span class="user-name">${escapeHtml(user.displayName)}</span>
                <span class="user-email">${escapeHtml(user.username ? '@' + user.username : user.email)}</span>
            </div>`;
        div.addEventListener('click', () => onSelect(user));
        frag.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(frag);
    container.classList.remove('hidden');
}

async function startChat(user) {
    try {
        const cid = await getOrCreateChat(currentUser.uid, user.id);
        selectChat(cid, user.id);
    } catch (err) {
        showToast('Could not start chat: ' + err.message, 'error');
    }
}

// ── Profile Modal ─────────────────────────────────────────────────────────────

function openProfileModal() {
    if (!currentUser) return;
    const ne = $('profile-display-name');
    const ee = $('profile-email');
    const ue = $('profile-username');
    if (ne) ne.value = currentUser.displayName || '';
    if (ee) ee.value = currentUser.email || '';
    if (ue) ue.value = currentUser.username || '';
    // Clear password fields
    const np = $('new-password');
    const cp = $('confirm-new-password');
    if (np) np.value = '';
    if (cp) cp.value = '';
    showModal('profile-modal');
}

async function handleSaveName(e) {
    e.preventDefault();
    if (!currentUser) return;
    const displayName = $('profile-display-name')?.value?.trim();
    if (!displayName) { showToast('Display name cannot be empty.', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
        await updateUserProfile(currentUser.uid, { displayName });
        currentUser.displayName = displayName;
        updateCurrentUserDisplay(currentUser);
        showToast('Name updated!', 'success');
        hideModal('profile-modal');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    const np = $('new-password')?.value;
    const cp = $('confirm-new-password')?.value;
    if (!np) { showToast('Enter a new password.', 'error'); return; }
    if (np.length < 6) { showToast('Password must be at least 6 characters.', 'error'); return; }
    if (np !== cp) { showToast('Passwords do not match.', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
        await changePassword(np);
        showToast('Password changed!', 'success');
        $('new-password').value = '';
        $('confirm-new-password').value = '';
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function handleLogout() {
    try { await signOut(); redirectTo('index.html'); }
    catch (err) { showToast('Logout failed.', 'error'); }
}
