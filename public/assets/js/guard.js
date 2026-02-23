// ============================================================
// guard.js — Auth route guards
// ============================================================
import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export function requireAuth() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      if (!user) window.location.replace('/index.html');
      else       resolve(user);
    });
  });
}

export function redirectIfAuthed() {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    if (user) window.location.replace('/app.html');
  });
}
