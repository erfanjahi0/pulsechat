/**
 * PulseChat - UI Renderer
 * Handle DOM manipulation and rendering
 */

// ============================================
// Toast Notifications
// ============================================

const toastContainer = document.getElementById('toast-container');

/**
 * Show a toast notification
 * @param {string} message
 * @param {string} type - 'success', 'error', 'info'
 * @param {number} duration - Duration in ms
 */
export const showToast = (message, type = 'info', duration = 3000) => {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const icon = getToastIcon(type);

    toast.innerHTML = `
        ${icon}
        <span>${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'toast-slide-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

/**
 * Get toast icon based on type
 * @param {string} type
 * @returns {string}
 */
const getToastIcon = (type) => {
    const icons = {
        success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>`,
        error: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>`,
        info: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>`
    };
    return icons[type] || icons.info;
};

// ============================================
// Error Message Display
// ============================================

/**
 * Show error message in form
 * @param {string} message
 */
export const showError = (message) => {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
};

/**
 * Hide error message
 */
export const hideError = () => {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.classList.remove('visible');
        errorEl.textContent = '';
    }
};

// ============================================
// Loading States
// ============================================

/**
 * Set button loading state
 * @param {HTMLButtonElement} button
 * @param {boolean} loading
 */
export const setButtonLoading = (button, loading = true) => {
    if (!button) return;

    const textEl = button.querySelector('.btn-text');
    const loadingEl = button.querySelector('.btn-loading');

    if (loading) {
        button.disabled = true;
        if (textEl) textEl.classList.add('hidden');
        if (loadingEl) loadingEl.classList.remove('hidden');
    } else {
        button.disabled = false;
        if (textEl) textEl.classList.remove('hidden');
        if (loadingEl) loadingEl.classList.add('hidden');
    }
};

// ============================================
// Auth Page Rendering
// ============================================

/**
 * Toggle between sign in and register tabs
 * @param {string} tab - 'signin' or 'register'
 */
export const switchAuthTab = (tab) => {
    const tabs = document.querySelectorAll('.auth-tab');
    const displayNameField = document.getElementById('display-name-field');
    const confirmPasswordField = document.getElementById('confirm-password-field');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn?.querySelector('.btn-text');

    tabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

    if (tab === 'register') {
        displayNameField?.classList.remove('hidden');
        confirmPasswordField?.classList.remove('hidden');
        if (btnText) btnText.textContent = 'Create Account';
    } else {
        displayNameField?.classList.add('hidden');
        confirmPasswordField?.classList.add('hidden');
        if (btnText) btnText.textContent = 'Sign In';
    }
};

// ============================================
// User Display
// ============================================

/**
 * Update current user display in sidebar
 * @param {object} user - User data
 */
export const updateCurrentUserDisplay = (user) => {
    const nameEl = document.getElementById('current-user-name');
    const avatarEl = document.getElementById('current-user-avatar');

    if (nameEl) {
        nameEl.textContent = user?.displayName || 'User';
    }

    if (avatarEl) {
        if (user?.photoURL) {
            avatarEl.innerHTML = `<img src="${escapeHtml(user.photoURL)}" alt="">`;
        } else {
            avatarEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>`;
        }
    }
};

// ============================================
// Chat List Rendering
// ============================================

/**
 * Render chat list
 * @param {array} chats - Array of chat objects
 * @param {string} currentUserId
 * @param {function} onSelectChat - Callback when chat is selected
 */
export const renderChatList = (chats, currentUserId, onSelectChat) => {
    const chatListEl = document.getElementById('chat-list');
    if (!chatListEl) return;

    if (chats.length === 0) {
        chatListEl.innerHTML = `
            <div class="empty-list">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>No conversations yet</p>
                <p>Start a new chat to get started</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    chats.forEach(chat => {
        // Find the other participant
        const otherUserId = chat.participants.find(id => id !== currentUserId);
        const otherUserData = chat.userData?.[otherUserId] || {};
        const unreadCount = chat.unreadCount?.[currentUserId] || 0;

        const chatItem = document.createElement('div');
        chatItem.className = 'chat-list-item';
        chatItem.setAttribute('role', 'listitem');
        chatItem.setAttribute('data-chat-id', chat.id);
        chatItem.setAttribute('data-user-id', otherUserId);

        chatItem.innerHTML = `
            <div class="avatar">
                ${otherUserData.photoURL
                    ? `<img src="${escapeHtml(otherUserData.photoURL)}" alt="">`
                    : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>`
                }
            </div>
            <div class="chat-list-content">
                <div class="chat-list-header">
                    <span class="chat-list-name">${escapeHtml(otherUserData.displayName || 'Unknown')}</span>
                    <span class="chat-list-time">${formatRelativeTime(chat.lastMessageAt)}</span>
                </div>
                <div class="chat-list-preview">
                    <span class="chat-list-message">${escapeHtml(chat.lastMessageText || 'No messages yet')}</span>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
                </div>
            </div>
        `;

        chatItem.addEventListener('click', () => onSelectChat(chat.id, otherUserId));
        fragment.appendChild(chatItem);
    });

    chatListEl.innerHTML = '';
    chatListEl.appendChild(fragment);
};

/**
 * Clear chat list loading state
 */
export const clearChatListLoading = () => {
    const chatListEl = document.getElementById('chat-list');
    if (chatListEl) {
        chatListEl.innerHTML = '';
    }
};

// ============================================
// Messages Rendering
// ============================================

/**
 * Render messages in chat
 * @param {array} messages - Array of message objects
 * @param {string} currentUserId
 * @param {boolean} append - Whether to append or replace
 */
export const renderMessages = (messages, currentUserId, append = false) => {
    const messagesListEl = document.getElementById('messages-list');
    const messagesLoadingEl = document.getElementById('messages-loading');
    if (!messagesListEl) return;

    // Hide loading
    if (messagesLoadingEl) {
        messagesLoadingEl.classList.add('hidden');
    }

    const fragment = document.createDocumentFragment();

    messages.forEach(message => {
        const isMine = message.from === currentUserId;
        const messageEl = createMessageElement(message, isMine);
        fragment.appendChild(messageEl);
    });

    if (append) {
        messagesListEl.appendChild(fragment);
    } else {
        messagesListEl.innerHTML = '';
        messagesListEl.appendChild(fragment);
    }

    // Scroll to bottom
    scrollToBottom();
};

/**
 * Create a single message element
 * @param {object} message
 * @param {boolean} isMine
 * @returns {HTMLElement}
 */
const createMessageElement = (message, isMine) => {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${isMine ? 'mine' : 'theirs'}`;
    messageEl.setAttribute('data-message-id', message.id);

    const time = message.createdAt
        ? formatMessageTime(message.createdAt)
        : 'Just now';

    messageEl.innerHTML = `
        <div class="message-bubble">${escapeHtml(message.text)}</div>
        <span class="message-time">${time}</span>
    `;

    return messageEl;
};

/**
 * Add a single new message
 * @param {object} message
 * @param {string} currentUserId
 */
export const addNewMessage = (message, currentUserId) => {
    const messagesListEl = document.getElementById('messages-list');
    if (!messagesListEl) return;

    const isMine = message.from === currentUserId;
    const messageEl = createMessageElement(message, isMine);

    messagesListEl.appendChild(messageEl);
    scrollToBottom();
};

/**
 * Clear messages loading
 */
export const clearMessagesLoading = () => {
    const loadingEl = document.getElementById('messages-loading');
    if (loadingEl) {
        loadingEl.innerHTML = '';
    }
};

// ============================================
// Chat Area Display
// ============================================

/**
 * Show chat area with active chat
 * @param {object} otherUser - Other participant data
 */
export const showChatArea = (otherUser) => {
    const chatEmpty = document.getElementById('chat-empty');
    const chatActive = document.getElementById('chat-active');
    const chatUserName = document.getElementById('chat-user-name');
    const chatUserAvatar = document.getElementById('chat-user-avatar');

    if (chatEmpty) chatEmpty.classList.add('hidden');
    if (chatActive) {
        chatActive.classList.remove('hidden');
        chatActive.classList.add('active-mobile');
    }

    if (chatUserName) {
        chatUserName.textContent = otherUser?.displayName || 'Unknown';
    }

    if (chatUserAvatar) {
        if (otherUser?.photoURL) {
            chatUserAvatar.innerHTML = `<img src="${escapeHtml(otherUser.photoURL)}" alt="">`;
        } else {
            chatUserAvatar.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>`;
        }
    }

    // Update status
    const statusEl = document.getElementById('chat-user-status');
    if (statusEl) {
        statusEl.textContent = formatLastSeen(otherUser?.lastSeen);
    }

    // Mobile: hide sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden-mobile');
    }
};

/**
 * Hide chat area and show empty state
 */
export const hideChatArea = () => {
    const chatEmpty = document.getElementById('chat-empty');
    const chatActive = document.getElementById('chat-active');

    if (chatEmpty) chatEmpty.classList.remove('hidden');
    if (chatActive) {
        chatActive.classList.add('hidden');
        chatActive.classList.remove('active-mobile');
    }

    // Mobile: show sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden-mobile');
    }
};

// ============================================
// Search Results
// ============================================

/**
 * Render search results
 * @param {array} results
 * @param {function} onSelect
 */
export const renderSearchResults = (results, onSelect) => {
    const resultsEl = document.getElementById('search-results') || document.getElementById('new-chat-results');
    if (!resultsEl) return;

    if (results.length === 0) {
        resultsEl.innerHTML = `
            <div class="empty-list">
                <p>No users found</p>
            </div>
        `;
        resultsEl.classList.remove('hidden');
        return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach(user => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.setAttribute('role', 'option');

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

        item.addEventListener('click', () => onSelect(user));
        fragment.appendChild(item);
    });

    resultsEl.innerHTML = '';
    resultsEl.appendChild(fragment);
    resultsEl.classList.remove('hidden');
};

/**
 * Hide search results
 */
export const hideSearchResults = () => {
    const resultsEl = document.getElementById('search-results') || document.getElementById('new-chat-results');
    if (resultsEl) {
        resultsEl.classList.add('hidden');
    }
};

// ============================================
// Composer
// ============================================

/**
 * Enable/disable send button based on input
 * @param {boolean} enabled
 */
export const setSendButtonEnabled = (enabled) => {
    const sendBtn = document.getElementById('btn-send');
    if (sendBtn) {
        sendBtn.disabled = !enabled;
    }
};

/**
 * Clear message input
 */
export const clearMessageInput = () => {
    const input = document.getElementById('message-input');
    if (input) {
        input.value = '';
        input.style.height = 'auto';
    }
    setSendButtonEnabled(false);
};

// ============================================
// Modal Management
// ============================================

/**
 * Show modal
 * @param {string} modalId
 */
export const showModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        // Focus first input
        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
};

/**
 * Hide modal
 * @param {string} modalId
 */
export const hideModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
};

// ============================================
// Utilities
// ============================================

/**
 * Scroll messages to bottom
 */
const scrollToBottom = () => {
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
};

/**
 * Format relative time
 * @param {Timestamp|Date|null} timestamp
 * @returns {string}
 */
const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString();
};

/**
 * Format message time
 * @param {Timestamp|Date} timestamp
 * @returns {string}
 */
const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format last seen
 * @param {Timestamp|Date|null} timestamp
 * @returns {string}
 */
const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Offline';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Active now';
    if (minutes < 60) return 'Active recently';
    if (hours < 24) return 'Active today';

    return 'Active recently';
};

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

export default {
    showToast,
    showError,
    hideError,
    setButtonLoading,
    switchAuthTab,
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
    hideModal
};
