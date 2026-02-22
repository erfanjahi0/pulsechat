/**
 * PulseChat v2 - Main App
 * Fixed: loading loop, profile update
 * New: dark/light mode toggle, username display in search
 */

import { onAuthChange, getUserProfile, updateLastSeen, signOut } from './modules/auth-service.js';
import { subscribeToChatList, searchUsers, getOrCreateChat, subscribeToMessages, markChatAsRead, sendMessage, getUserById } from './modules/db-service.js';
import { updateCurrentUserDisplay, renderChatList, clearChatListLoading, renderMessages, clearMessagesLoading, showChatArea, hideChatArea, renderSearchResults, hideSearchResults, setSendButtonEnabled, clearMessageInput, showModal, hideModal, showToast } from './modules/ui-renderer.js';
import { debounce, isMobile, redirectTo, autoResizeTextarea, escapeHtml } from './modules/utils.js';

// ── State ─────────────────────────────────────────────────────────────────────

let currentUser         = null;
let currentChatId       = null;
let currentOtherUserId  = null;
let unsubscribeChatList = null;
let unsubscribeMessages = null;

// ── Dark mode ─────────────────────────────────────────────────────────────────

const savedTheme = localStorage.getItem('pulsechat-theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pulsechat-theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    icon.innerHTML = theme === 'dark'
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

updateThemeIcon(savedTheme);

// ── Auth gate ─────────────────────────────────────────────────────────────────
// FIX: added a timeout to prevent infinite loading if auth takes too long

let authResolved = false;
const authTimeout = setTimeout(() => {
    if (!authResolved) {
        console.warn('Auth timeout — redirecting to login');
        redirectTo('index.html');
    }
}, 8000);

onAuthChange(async (user) => {
    authResolved = true;
    clearTimeout(authTimeout);

    if (!user) {
        redirectTo('index.html');
        return;
    }

    // Load profile
    currentUser = await getUserProfile(user.id);

    if (!currentUser) {
        // Fallback — use auth data directly
        currentUser = {
            uid: user.id, id: user.id,
            email: user.email,
            displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || 'User',
            photoURL: user.user_metadata?.avatar_url || null,
            username: null
        };
    }

    updateCurrentUserDisplay(currentUser);
    updateLastSeen(currentUser.uid);
    subscribeToChatListData();

    setInterval(() => { if (currentUser?.uid) updateLastSeen(currentUser.uid); }, 60000);
});

// ── DOM refs ──────────────────────────────────────────────────────────────────

const messageForm        = document.getElementById('message-form');
const messageInput       = document.getElementById('message-input');
const userSearch         = document.getElementById('user-search');
const searchClear        = document.getElementById('search-clear');
const newChatBtn         = document.getElementById('new-chat-btn');
const btnBack            = document.getElementById('btn-back');
const profileModal       = document.getElementById('profile-modal');
const closeProfileModal  = document.getElementById('close-profile-modal');
const profileForm        = document.getElementById('profile-form');
const logoutBtn          = document.getElementById('logout-btn');
const newChatModal       = document.getElementById('new-chat-modal');
const closeNewChatModal  = document.getElementById('close-new-chat-modal');
const newChatSearch      = document.getElementById('new-chat-search');
const themeToggle        = document.getElementById('theme-toggle');
const userProfileTrigger = document.getElementById('user-profile-trigger');

// ── Theme toggle ──────────────────────────────────────────────────────────────

themeToggle?.addEventListener('click', toggleTheme);

// ── Message input ─────────────────────────────────────────────────────────────

messageInput?.addEventListener('input', () => {
    setSendButtonEnabled(messageInput.value.trim().length > 0);
    autoResizeTextarea(messageInput);
});

messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (messageInput.value.trim()) handleSendMessage();
    }
});

messageForm?.addEventListener('submit', (e) => { e.preventDefault(); handleSendMessage(); });

// ── User search ───────────────────────────────────────────────────────────────

if (userSearch) {
    const debouncedSearch = debounce((q) => handleUserSearch(q), 300);
    userSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        searchClear?.classList.toggle('hidden', !q);
        q.length >= 2 ? debouncedSearch(q) : hideSearchResults();
    });
    userSearch.addEventListener('blur', () => setTimeout(hideSearchResults, 200));
}

searchClear?.addEventListener('click', () => {
    userSearch.value = '';
    searchClear.classList.add('hidden');
    hideSearchResults();
    userSearch.focus();
});

// ── New chat / back ───────────────────────────────────────────────────────────

newChatBtn?.addEventListener('click', () => showModal('new-chat-modal'));
btnBack?.addEventListener('click', handleBackToChatList);

// ── Profile modal ─────────────────────────────────────────────────────────────

closeProfileModal?.addEventListener('click', () => hideModal('profile-modal'));
profileModal?.addEventListener('click', (e) => { if (e.target === profileModal) hideModal('profile-modal'); });
profileForm?.addEventListener('submit', handleProfileUpdate);
logoutBtn?.addEventListener('click', handleLogout);
userProfileTrigger?.addEventListener('click', () => {
    populateProfileModal();
    showModal('profile-modal');
});

// ── New chat modal ────────────────────────────────────────────────────────────

closeNewChatModal?.addEventListener('click', () => hideModal('new-chat-modal'));
newChatModal?.addEventListener('click', (e) => { if (e.target === newChatModal) hideModal('new-chat-modal'); });

if (newChatSearch) {
    const debouncedSearch = debounce((q) => handleNewChatSearch(q), 300);
    newChatSearch.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        q.length >= 2 ? debouncedSearch(q) : (document.getElementById('new-chat-results').innerHTML = '<p style="text-align:center;color:var(--color-text-tertiary);padding:20px;font-size:13px">Search by @username or email</p>');
    });
}

// ── Chat list ─────────────────────────────────────────────────────────────────

function subscribeToChatListData() {
    unsubscribeChatList?.();
    unsubscribeChatList = subscribeToChatList(currentUser.uid, (chats) => {
        clearChatListLoading();
        renderChatList(chats, currentUser.uid, handleSelectChat);
    });
}

async function handleSelectChat(chatId, otherUserId) {
    unsubscribeMessages?.();

    currentChatId      = chatId;
    currentOtherUserId = otherUserId;

    const otherUser = await getUserById(otherUserId);
    showChatArea(otherUser);

    const messagesList = document.getElementById('messages-list');
    if (messagesList) messagesList.innerHTML = '';
    clearMessagesLoading();

    await markChatAsRead(chatId, currentUser.uid);

    unsubscribeMessages = subscribeToMessages(chatId, (messages) => {
        clearMessagesLoading();
        renderMessages(messages, currentUser.uid);
    });
}

// ── Messaging ─────────────────────────────────────────────────────────────────

async function handleSendMessage() {
    if (!currentChatId || !messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;
    clearMessageInput();
    try {
        await sendMessage(currentChatId, currentUser.uid, currentOtherUserId, text);
    } catch (err) {
        showToast('Failed to send message.', 'error');
    }
}

// ── Search ────────────────────────────────────────────────────────────────────

async function handleUserSearch(query) {
    try {
        const results = await searchUsers(query, currentUser.uid);
        renderSearchResults(results, (user) => handleStartChat(user));
    } catch (err) { console.error(err); }
}

async function handleNewChatSearch(query) {
    try {
        const results = await searchUsers(query, currentUser.uid);
        const resultsEl = document.getElementById('new-chat-results');
        if (!resultsEl) return;

        if (results.length === 0) {
            resultsEl.innerHTML = '<div class="empty-list"><p>No users found</p><p style="font-size:12px;margin-top:4px">Try searching by @username or email</p></div>';
            return;
        }

        const frag = document.createDocumentFragment();
        results.forEach(user => {
            const item = document.createElement('div');
            item.className = 'new-chat-result-item';
            item.innerHTML = `
                <div class="avatar">
                    ${user.photoURL
                        ? `<img src="${escapeHtml(user.photoURL)}" alt="">`
                        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`
                    }
                </div>
                <div class="user-info">
                    <span class="user-name">${escapeHtml(user.displayName || 'Unknown')}</span>
                    <span class="user-email">${user.username ? '@' + escapeHtml(user.username) : escapeHtml(user.email || '')}</span>
                </div>`;
            item.addEventListener('click', () => {
                handleStartChat(user);
                hideModal('new-chat-modal');
                newChatSearch.value = '';
                document.getElementById('new-chat-results').innerHTML = '';
            });
            frag.appendChild(item);
        });

        resultsEl.innerHTML = '';
        resultsEl.appendChild(frag);
    } catch (err) { console.error(err); }
}

async function handleStartChat(user) {
    try {
        const chatId = await getOrCreateChat(currentUser.uid, user.id);
        handleSelectChat(chatId, user.id);
    } catch (err) {
        showToast('Failed to start conversation.', 'error');
    }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function handleBackToChatList() {
    unsubscribeMessages?.();
    unsubscribeMessages = null;
    currentChatId = null;
    currentOtherUserId = null;
    hideChatArea();
    const ml = document.getElementById('messages-list');
    if (ml) ml.innerHTML = '';
}

// ── Profile modal helpers ─────────────────────────────────────────────────────

function populateProfileModal() {
    const nameEl     = document.getElementById('profile-display-name');
    const emailEl    = document.getElementById('profile-email');
    const usernameEl = document.getElementById('profile-username');

    if (nameEl)     nameEl.value     = currentUser?.displayName || '';
    if (emailEl)    emailEl.value    = currentUser?.email || '';
    if (usernameEl) usernameEl.value = currentUser?.username || '';
}

async function handleProfileUpdate(e) {
    e.preventDefault();

    const displayName = document.getElementById('profile-display-name')?.value?.trim();
    if (!displayName) { showToast('Display name cannot be empty.', 'error'); return; }

    const saveBtn = profileForm.querySelector('button[type="submit"]');

    try {
        if (saveBtn) saveBtn.disabled = true;
        const { updateUserProfile } = await import('./modules/auth-service.js');
        await updateUserProfile(currentUser.uid, { displayName });
        currentUser.displayName = displayName;
        updateCurrentUserDisplay(currentUser);
        showToast('Profile updated!', 'success');
        hideModal('profile-modal');
    } catch (err) {
        showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

async function handleLogout() {
    try {
        await signOut();
        redirectTo('index.html');
    } catch (err) {
        showToast('Failed to log out.', 'error');
    }
}
