/**
 * PulseChat - Main App Entry Point
 * Handle app UI, chat list, and messaging
 */

import {
    onAuthChange,
    getUserProfile,
    updateLastSeen,
    signOut
} from './modules/auth-service.js';

import {
    subscribeToChatList,
    searchUsers,
    getOrCreateChat,
    subscribeToMessages,
    markChatAsRead,
    sendMessage,
    getUserById
} from './modules/db-service.js';

import {
    updateCurrentUserDisplay,
    renderChatList,
    clearChatListLoading,
    renderMessages,
    addNewMessage,
    clearMessagesLoading,
    showChatArea,
    hideChatArea,
    renderSearchResults,
    hideSearchResults,
    setSendButtonEnabled,
    clearMessageInput,
    showModal,
    hideModal,
    showToast
} from './modules/ui-renderer.js';

import {
    debounce,
    isMobile,
    redirectTo,
    autoResizeTextarea
} from './modules/utils.js';

// ============================================
// State
// ============================================

let currentUser = null;
let currentChatId = null;
let currentOtherUserId = null;
let unsubscribeChatList = null;
let unsubscribeMessages = null;
let chatUsersCache = {};

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

    // Update UI
    updateCurrentUserDisplay(currentUser);

    // Update last seen
    updateLastSeen(currentUser.uid);

    // Subscribe to chat list
    subscribeToChatListData();

    // Set up periodic last seen update
    setInterval(() => {
        if (currentUser?.uid) {
            updateLastSeen(currentUser.uid);
        }
    }, 60000); // Every minute
});

// ============================================
// DOM Elements
// ============================================

const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const userSearch = document.getElementById('user-search');
const searchClear = document.getElementById('search-clear');
const newChatBtn = document.getElementById('new-chat-btn');
const btnBack = document.getElementById('btn-back');

const profileModal = document.getElementById('profile-modal');
const closeProfileModal = document.getElementById('close-profile-modal');
const profileForm = document.getElementById('profile-form');
const logoutBtn = document.getElementById('logout-btn');

const newChatModal = document.getElementById('new-chat-modal');
const closeNewChatModal = document.getElementById('close-new-chat-modal');
const newChatSearch = document.getElementById('new-chat-search');

// ============================================
// Event Listeners
// ============================================

// Message input
if (messageInput) {
    messageInput.addEventListener('input', () => {
        const hasText = messageInput.value.trim().length > 0;
        setSendButtonEnabled(hasText);
        autoResizeTextarea(messageInput);
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (messageInput.value.trim()) {
                handleSendMessage();
            }
        }
    });
}

// Send message form
if (messageForm) {
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage();
    });
}

// User search
if (userSearch) {
    const debouncedSearch = debounce((query) => {
        handleUserSearch(query);
    }, 300);

    userSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        searchClear?.classList.toggle('hidden', !query);

        if (query.length >= 2) {
            debouncedSearch(query);
        } else {
            hideSearchResults();
        }
    });

    userSearch.addEventListener('blur', () => {
        // Delay to allow click on search result
        setTimeout(() => {
            hideSearchResults();
        }, 200);
    });
}

// Clear search
if (searchClear) {
    searchClear.addEventListener('click', () => {
        userSearch.value = '';
        searchClear.classList.add('hidden');
        hideSearchResults();
        userSearch.focus();
    });
}

// New chat button
if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
        showModal('new-chat-modal');
    });
}

// Back button (mobile)
if (btnBack) {
    btnBack.addEventListener('click', () => {
        handleBackToChatList();
    });
}

// Profile modal
if (closeProfileModal) {
    closeProfileModal.addEventListener('click', () => {
        hideModal('profile-modal');
    });
}

if (profileModal) {
    profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            hideModal('profile-modal');
        }
    });
}

// Profile form
if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// New chat modal
if (closeNewChatModal) {
    closeNewChatModal.addEventListener('click', () => {
        hideModal('new-chat-modal');
    });
}

if (newChatModal) {
    newChatModal.addEventListener('click', (e) => {
        if (e.target === newChatModal) {
            hideModal('new-chat-modal');
        }
    });
}

// New chat search
if (newChatSearch) {
    const debouncedSearch = debounce((query) => {
        handleNewChatSearch(query);
    }, 300);

    newChatSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (query.length >= 2) {
            debouncedSearch(query);
        } else {
            document.getElementById('new-chat-results').innerHTML = '';
        }
    });
}

// User profile trigger
const userProfileTrigger = document.getElementById('user-profile-trigger');
if (userProfileTrigger) {
    userProfileTrigger.addEventListener('click', () => {
        showModal('profile-modal');
    });

    userProfileTrigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showModal('profile-modal');
        }
    });
}

// ============================================
// Chat List
// ============================================

/**
 * Subscribe to chat list updates
 */
function subscribeToChatListData() {
    if (unsubscribeChatList) {
        unsubscribeChatList();
    }

    unsubscribeChatList = subscribeToChatList(currentUser.uid, (chats) => {
        clearChatListLoading();
        renderChatList(chats, currentUser.uid, handleSelectChat);
    });
}

/**
 * Handle selecting a chat
 * @param {string} chatId
 * @param {string} otherUserId
 */
async function handleSelectChat(chatId, otherUserId) {
    // Unsubscribe from previous messages
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    currentChatId = chatId;
    currentOtherUserId = otherUserId;

    // Load other user data
    const otherUser = await getUserById(otherUserId);
    showChatArea(otherUser);

    // Clear previous messages and show loading
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
        messagesList.innerHTML = '';
    }
    clearMessagesLoading();

    // Mark as read
    await markChatAsRead(chatId, currentUser.uid);

    // Subscribe to messages
    unsubscribeMessages = subscribeToMessages(chatId, (messages) => {
        clearMessagesLoading();
        renderMessages(messages, currentUser.uid);
    });
}

// ============================================
// Messaging
// ============================================

/**
 * Handle sending a message
 */
async function handleSendMessage() {
    if (!currentChatId || !messageInput) return;

    const text = messageInput.value.trim();
    if (!text) return;

    // Clear input immediately (optimistic UI)
    clearMessageInput();

    try {
        await sendMessage(currentChatId, currentUser.uid, currentOtherUserId, text);
    } catch (error) {
        showToast('Failed to send message', 'error');
        console.error('Error sending message:', error);
    }
}

// ============================================
// User Search
// ============================================

/**
 * Handle user search
 * @param {string} query
 */
async function handleUserSearch(query) {
    try {
        const results = await searchUsers(query, currentUser.uid);
        renderSearchResults(results, (user) => {
            handleStartChat(user);
        });
    } catch (error) {
        console.error('Search error:', error);
    }
}

/**
 * Handle new chat search
 * @param {string} query
 */
async function handleNewChatSearch(query) {
    try {
        const results = await searchUsers(query, currentUser.uid);
        const resultsEl = document.getElementById('new-chat-results');

        if (results.length === 0) {
            resultsEl.innerHTML = '<div class="empty-list"><p>No users found</p></div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        results.forEach(user => {
            const item = document.createElement('div');
            item.className = 'new-chat-result-item';
            item.innerHTML = `
                <div class="avatar">
                    ${user.photoURL
                        ? `<img src="${escapeHtml(user.photoURL)}" alt="">`
                        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>`
                    }
                </div>
                <div class="user-info">
                    <span class="user-name">${escapeHtml(user.displayName || 'Unknown')}</span>
                    <span class="user-email">${escapeHtml(user.email || '')}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                handleStartChat(user);
                hideModal('new-chat-modal');
                newChatSearch.value = '';
            });

            fragment.appendChild(item);
        });

        resultsEl.innerHTML = '';
        resultsEl.appendChild(fragment);
    } catch (error) {
        console.error('Search error:', error);
    }
}

/**
 * Handle starting a new chat
 * @param {object} user
 */
async function handleStartChat(user) {
    try {
        const chatId = await getOrCreateChat(currentUser.uid, user.id);
        handleSelectChat(chatId, user.id);
    } catch (error) {
        showToast('Failed to start chat', 'error');
        console.error('Error starting chat:', error);
    }
}

// ============================================
// Navigation
// ============================================

/**
 * Handle back to chat list (mobile)
 */
function handleBackToChatList() {
    // Unsubscribe from messages
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    currentChatId = null;
    currentOtherUserId = null;

    hideChatArea();

    // Clear messages
    const messagesList = document.getElementById('messages-list');
    if (messagesList) {
        messagesList.innerHTML = '';
    }
}

// ============================================
// Profile
// ============================================

/**
 * Handle profile update
 * @param {Event} e
 */
async function handleProfileUpdate(e) {
    e.preventDefault();

    const displayName = document.getElementById('profile-display-name')?.value?.trim();
    const email = document.getElementById('profile-email');

    if (!displayName) {
        showToast('Please enter a display name', 'error');
        return;
    }

    try {
        const { updateUserProfile } = await import('./modules/auth-service.js');
        await updateUserProfile(currentUser.uid, { displayName });

        currentUser.displayName = displayName;
        updateCurrentUserDisplay(currentUser);

        showToast('Profile updated successfully', 'success');
        hideModal('profile-modal');
    } catch (error) {
        showToast('Failed to update profile', 'error');
        console.error('Error updating profile:', error);
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

// ============================================
// Utility
// ============================================

/**
 * Escape HTML
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
