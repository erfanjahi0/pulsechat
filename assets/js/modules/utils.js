/**
 * PulseChat - Utility Functions
 * Common helper functions
 */

// ============================================
// Debounce
// ============================================

/**
 * Debounce function execution
 * @param {function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {function} Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// ============================================
// Throttle
// ============================================

/**
 * Throttle function execution
 * @param {function} func - Function to throttle
 * @param {number} limit - Limit in milliseconds
 * @returns {function} Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;

    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// ============================================
// Text Formatting
// ============================================

/**
 * Safely escape HTML
 * @param {string} text
 * @returns {string}
 */
export const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Truncate text to specified length
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 * @param {string} text
 * @returns {string}
 */
export const capitalize = (text) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
};

// ============================================
// Date/Time Formatting
// ============================================

/**
 * Format timestamp to relative time
 * @param {Timestamp|Date|number} timestamp
 * @returns {string}
 */
export const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;

    return date.toLocaleDateString();
};

/**
 * Format timestamp to message time
 * @param {Timestamp|Date|number} timestamp
 * @returns {string}
 */
export const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Format timestamp to chat list time
 * @param {Timestamp|Date|number} timestamp
 * @returns {string}
 */
export const formatChatListTime = (timestamp) => {
    if (!timestamp) return '';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    if (messageDate.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    }

    const diffDays = Math.floor((today - messageDate) / 86400000);

    if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Format last seen timestamp
 * @param {Timestamp|Date|number|null} timestamp
 * @returns {string}
 */
export const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Offline';

    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }

    const now = new Date();
    const diff = now - date;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return 'Active now';
    if (minutes < 60) return 'Active recently';
    if (hours < 24) return 'Active today';

    return 'Active recently';
};

// ============================================
// Validation
// ============================================

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password
 * @returns {object} - { valid: boolean, message: string }
 */
export const validatePassword = (password) => {
    if (!password) {
        return { valid: false, message: 'Password is required' };
    }

    if (password.length < 6) {
        return { valid: false, message: 'Password must be at least 6 characters' };
    }

    return { valid: true, message: '' };
};

/**
 * Validate display name
 * @param {string} displayName
 * @returns {object} - { valid: boolean, message: string }
 */
export const validateDisplayName = (displayName) => {
    if (!displayName || !displayName.trim()) {
        return { valid: false, message: 'Display name is required' };
    }

    if (displayName.trim().length < 2) {
        return { valid: false, message: 'Display name must be at least 2 characters' };
    }

    if (displayName.length > 50) {
        return { valid: false, message: 'Display name must be less than 50 characters' };
    }

    return { valid: true, message: '' };
};

// ============================================
// URL Helpers
// ============================================

/**
 * Get URL parameters
 * @returns {object}
 */
export const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
};

/**
 * Redirect to URL
 * @param {string} url
 */
export const redirectTo = (url) => {
    window.location.href = url;
};

/**
 * Get current page name
 * @returns {string}
 */
export const getCurrentPage = () => {
    return window.location.pathname.split('/').pop() || 'index.html';
};

// ============================================
// Device Detection
// ============================================

/**
 * Check if user is on mobile device
 * @returns {boolean}
 */
export const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Check if user prefers reduced motion
 * @returns {boolean}
 */
export const prefersReducedMotion = () => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// ============================================
// Storage
// ============================================

/**
 * Store data in localStorage
 * @param {string} key
 * @param {any} value
 */
export const setStorageItem = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
};

/**
 * Get data from localStorage
 * @param {string} key
 * @param {any} defaultValue
 * @returns {any}
 */
export const getStorageItem = (key, defaultValue = null) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
};

/**
 * Remove item from localStorage
 * @param {string} key
 */
export const removeStorageItem = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error('Error removing from localStorage:', error);
    }
};

// ============================================
// Auto-resize Textarea
// ============================================

/**
 * Auto-resize textarea based on content
 * @param {HTMLTextAreaElement} textarea
 */
export const autoResizeTextarea = (textarea) => {
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
};

// ============================================
// Copy to Clipboard
// ============================================

/**
 * Copy text to clipboard
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        return false;
    }
};

export default {
    debounce,
    throttle,
    escapeHtml,
    truncateText,
    capitalize,
    formatRelativeTime,
    formatMessageTime,
    formatChatListTime,
    formatLastSeen,
    isValidEmail,
    validatePassword,
    validateDisplayName,
    getUrlParams,
    redirectTo,
    getCurrentPage,
    isMobile,
    prefersReducedMotion,
    setStorageItem,
    getStorageItem,
    removeStorageItem,
    autoResizeTextarea,
    copyToClipboard
};
