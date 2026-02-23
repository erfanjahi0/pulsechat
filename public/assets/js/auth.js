// ============================================================
// auth.js — Authentication: email/password + Google
// ============================================================
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { generateUsername } from './utils.js';
import { reserveInitialUsername, lookupUidByUsername } from './username.js';
import { toast } from './ui.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Create user document ──────────────────────────────────

export async function upsertUser(user, extras = {}) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  const data = {
    uid:          user.uid,
    email:        user.email,
    displayName:  extras.displayName || user.displayName || user.email.split('@')[0],
    photoURL:     user.photoURL || null,
    lastSeen:     serverTimestamp(),
    authProvider: extras.authProvider || 'password',
    blockedUsers: snap.exists() ? undefined : [],  // only set on create
  };

  // Remove undefined keys
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

  if (!snap.exists()) {
    data.createdAt    = serverTimestamp();
    data.blockedUsers = [];
    // Generate initial username
    const base = extras.displayName || user.displayName || user.email.split('@')[0];
    let username   = generateUsername(base);
    let attempts   = 0;

    // Try up to 5 times to get a unique username
    while (attempts < 5) {
      try {
        await setDoc(ref, { ...data, username }, { merge: true });
        await reserveInitialUsername(user.uid, username);
        return { ...data, username };
      } catch (e) {
        if (e.message === 'USERNAME_TAKEN') {
          username = generateUsername(base);
          attempts++;
        } else {
          throw e;
        }
      }
    }
    // fallback: uid prefix
    username = 'user_' + user.uid.slice(0, 8);
    await setDoc(ref, { ...data, username }, { merge: true });
    try { await reserveInitialUsername(user.uid, username); } catch {}
    return { ...data, username };
  }

  await setDoc(ref, data, { merge: true });
  return snap.data();
}

// ── Register ──────────────────────────────────────────────

export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await upsertUser(cred.user, { displayName, authProvider: 'password' });
  return cred.user;
}

// ── Login ─────────────────────────────────────────────────

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// ── Google ────────────────────────────────────────────────

export async function loginWithGoogle() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) {
    sessionStorage.setItem('googleRedirect', '1');
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
  const cred = await signInWithPopup(auth, googleProvider);
  await upsertUser(cred.user, { authProvider: 'google' });
  return cred.user;
}

export async function handleGoogleRedirect() {
  if (!sessionStorage.getItem('googleRedirect')) return null;
  sessionStorage.removeItem('googleRedirect');
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await upsertUser(result.user, { authProvider: 'google' });
      return result.user;
    }
  } catch (err) {
    console.error('Google redirect error:', err);
    toast('Google sign-in failed. Please try again.', 'error');
  }
  return null;
}

// ── Logout ────────────────────────────────────────────────

export async function logout() { await signOut(auth); }

// ── Password change ───────────────────────────────────────

/**
 * Verify old password then set new password.
 * @param {import('firebase/auth').User} user
 * @param {string} oldPassword
 * @param {string} newPassword
 */
export async function changePassword(user, oldPassword, newPassword) {
  const credential = EmailAuthProvider.credential(user.email, oldPassword);
  await reauthenticateWithCredential(user, credential); // throws if wrong
  await updatePassword(user, newPassword);
}

// ── Friendly error messages ───────────────────────────────

export function friendlyAuthError(code) {
  const map = {
    'auth/email-already-in-use':    'That email is already registered.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/too-many-requests':       'Too many attempts. Try again later.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/popup-closed-by-user':    'Sign-in cancelled.',
    'auth/cancelled-popup-request': 'Sign-in cancelled.',
    'auth/requires-recent-login':   'Please sign out and sign back in to do this.',
  };
  return map[code] || 'An unexpected error occurred. Please try again.';
}
