// ============================================================
// utils.js — Shared utilities
// ============================================================

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

export function formatTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now   = new Date();
  const diffDays = Math.floor((now - date) / 86400000);

  if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays < 7)   return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDateLabel(ts) {
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now   = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, now))       return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

export function safeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

export function getInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

export function isMobile() { return window.innerWidth <= 768; }

export function avatarColor(str) {
  let h = 0;
  for (const c of (str || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 48%, 38%)`;
}

/**
 * Generate a random username from a display name.
 * e.g. "Jane Smith" → "janesmith_8472"
 * @param {string} displayName
 * @returns {string}
 */
export function generateUsername(displayName) {
  const base = (displayName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 14)
    || 'user';

  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}_${suffix}`;
}

/**
 * Validate username format: 3-20 chars, lowercase letters, digits, underscores.
 * Cannot start or end with underscore.
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(username) {
  if (!username) return { valid: false, error: 'Username is required.' };
  if (username.length < 3)  return { valid: false, error: 'Must be at least 3 characters.' };
  if (username.length > 20) return { valid: false, error: 'Must be 20 characters or fewer.' };
  if (!/^[a-z0-9_]+$/.test(username)) return { valid: false, error: 'Only lowercase letters, numbers and underscores.' };
  if (username.startsWith('_') || username.endsWith('_')) return { valid: false, error: 'Cannot start or end with underscore.' };
  return { valid: true };
}

/**
 * Days remaining until a cooldown expires.
 * @param {import('firebase/firestore').Timestamp | null} ts
 * @param {number} cooldownDays
 * @returns {number} 0 if expired/null
 */
export function cooldownDaysLeft(ts, cooldownDays = 7) {
  if (!ts) return 0;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff  = cooldownDays * 86400000 - (Date.now() - date.getTime());
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

/**
 * Resize an image file to a canvas and return a base64 JPEG data URL.
 * @param {File} file
 * @param {number} maxSize  pixels
 * @param {number} quality  0–1
 * @returns {Promise<string>} data URL
 */
export function resizeImageToDataURL(file, maxSize = 256, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image.')); };
    img.src = url;
  });
}
