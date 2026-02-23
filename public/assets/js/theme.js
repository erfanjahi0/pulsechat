// ============================================================
// theme.js — Dark / light theme management
// ============================================================

const STORAGE_KEY = 'pulsechat_theme';

/**
 * Apply a theme to <html data-theme="...">
 * @param {'dark'|'light'} theme
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Load saved theme (or detect system preference).
 * Call this early in <head> or on DOMContentLoaded.
 */
export function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved);
    return saved;
  }
  // Detect system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = prefersDark ? 'dark' : 'light';
  applyTheme(initial);
  return initial;
}

/**
 * Toggle between dark and light.
 * @returns {'dark'|'light'} new theme
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next    = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * Get the current theme.
 * @returns {'dark'|'light'}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Wire up a toggle button element.
 * The button should have children with class .icon-sun and .icon-moon.
 * CSS handles showing/hiding them via [data-theme="light"].
 * @param {HTMLElement} btn
 */
export function wireThemeButton(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = toggleTheme();
    btn.setAttribute('aria-label', next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });

  // Set initial aria-label
  const current = getTheme();
  btn.setAttribute('aria-label', current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}
