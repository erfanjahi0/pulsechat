// ============================================================
// ui.js — Toasts, skeletons, modals, avatar builder
// ============================================================
import { safeText, getInitials, avatarColor } from './utils.js';

// ── Toast ─────────────────────────────────────────────────

let _container = null;

function getContainer() {
  if (!_container) {
    _container = document.getElementById('toast-container');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'toast-container';
      document.body.appendChild(_container);
    }
  }
  return _container;
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'|'warn'} type
 * @param {number} duration
 */
export function toast(message, type = 'info', duration = 3800) {
  const c   = getContainer();
  const el  = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'alert');

  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '!' };
  el.innerHTML = `<span class="toast-icon">${icons[type] ?? 'ℹ'}</span><span>${safeText(message)}</span>`;
  c.appendChild(el);

  const remove = () => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ── Skeletons ─────────────────────────────────────────────

export function renderChatListSkeletons(container, count = 5) {
  const f = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'skeleton-chat-item';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div class="skeleton" style="width:42px;height:42px;border-radius:50%;flex-shrink:0;"></div>
      <div class="skeleton-lines">
        <div class="skeleton" style="height:13px;width:${55 + (i%4)*15}%;"></div>
        <div class="skeleton" style="height:11px;width:${35 + (i%3)*18}%;"></div>
      </div>`;
    f.appendChild(el);
  }
  container.innerHTML = '';
  container.appendChild(f);
}

export function renderMessageSkeletons(container, count = 6) {
  const f = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const mine = i % 3 === 0;
    const el   = document.createElement('div');
    el.className = `skeleton-msg${mine ? ' mine' : ''}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="skeleton" style="height:36px;width:${90 + (i%5)*35}px;border-radius:14px;"></div>`;
    f.appendChild(el);
  }
  container.innerHTML = '';
  container.appendChild(f);
}

// ── Avatar ────────────────────────────────────────────────

/**
 * Build an avatar element with photo or initials.
 * @param {{ displayName?: string, photoURL?: string }} user
 * @param {'sm'|'md'|'lg'|'xl'} size
 */
export function buildAvatar(user, size = 'md') {
  const el   = document.createElement('div');
  el.className = `avatar avatar-${size}`;
  const name = user?.displayName || '?';
  el.style.background = avatarColor(name);

  if (user?.photoURL) {
    const img = document.createElement('img');
    img.src  = user.photoURL;
    img.alt  = safeText(name);
    img.loading = 'lazy';
    img.onerror = () => { img.remove(); el.textContent = getInitials(name); };
    el.appendChild(img);
  } else {
    el.textContent = getInitials(name);
  }
  return el;
}

// ── Button loading state ──────────────────────────────────

export function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    const dark = btn.classList.contains('btn-google');
    btn.innerHTML = `<span class="spinner${dark ? ' spinner-dark' : ''}"></span>`;
    btn.disabled  = true;
  } else {
    btn.innerHTML = btn.dataset.originalHtml || 'Submit';
    btn.disabled  = false;
  }
}

// ── Form errors ───────────────────────────────────────────

export function showFormError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
}

export function clearFormError(el) {
  if (!el) return;
  el.textContent = '';
  el.classList.remove('visible');
}

// ── Visibility ────────────────────────────────────────────

export function setVisible(el, visible) {
  el?.classList.toggle('hidden', !visible);
}

// ── Modal helpers ─────────────────────────────────────────

/**
 * Create and show a modal.
 * @param {{ title: string, body: string|HTMLElement, actions: { label: string, class: string, onClick: Function }[] }} opts
 * @returns {{ close: () => void }}
 */
export function showModal({ title, body, actions = [] }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `<h2 class="modal-title">${safeText(title)}</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.className   = 'btn btn-icon';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
  header.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  for (const action of actions) {
    const btn = document.createElement('button');
    btn.className   = `btn ${action.class || 'btn-secondary'}`;
    btn.textContent = action.label;
    btn.addEventListener('click', () => action.onClick(close));
    footer.appendChild(btn);
  }

  modal.appendChild(header);
  modal.appendChild(bodyEl);
  if (actions.length) modal.appendChild(footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Trap focus
  modal.querySelector('button, input, textarea, [tabindex]')?.focus();

  function close() {
    backdrop.classList.add('closing');
    modal.classList.add('closing');
    backdrop.addEventListener('animationend', () => backdrop.remove(), { once: true });
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  return { close };
}

// ── Empty state ───────────────────────────────────────────

export function showEmptyChat(container) {
  container.innerHTML = `
    <div class="chat-empty" role="status">
      <div class="chat-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3>Your conversations</h3>
      <p>Search by username or email to start chatting</p>
    </div>
  `;
}
