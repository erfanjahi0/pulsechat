// ============================================================
// auth.js — Authentication (FIXED v2)
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
  doc, setDoc, getDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { generateUsername } from './utils.js';
import { toast } from './ui.js';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ── Create / update Firestore user doc ────────────────────
// FIX: Simplified — no complex transaction loop that could fail silently.
export async function upsertUser(user, extras = {}) {
  if (!user?.uid) return null;
  const ref  = doc(db, 'users', user.uid);
  let snap;
  try { snap = await getDoc(ref); }
  catch (e) { console.error('upsertUser getDoc failed:', e); return null; }

  const displayName = extras.displayName || user.displayName
    || (user.email || '').split('@')[0] || 'User';

  if (snap.exists()) {
    try { await updateDoc(ref, { lastSeen: serverTimestamp() }); } catch {}
    return snap.data();
  }

  // New user
  const username = generateUsername(displayName);
  const data = {
    uid:          user.uid,
    email:        user.email || '',
    displayName,
    photoURL:     user.photoURL || null,
    authProvider: extras.authProvider || 'password',
    createdAt:    serverTimestamp(),
    lastSeen:     serverTimestamp(),
    blockedUsers: [],
    username,
  };

  await setDoc(ref, data);

  // Reserve username — best-effort, non-fatal
  try {
    await setDoc(doc(db, 'usernames', username), {
      uid: user.uid, reservedAt: serverTimestamp(),
    });
  } catch (e) { console.warn('Username reservation non-fatal:', e.message); }

  return data;
}

// ── Email / Password ──────────────────────────────────────
export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try { await updateProfile(cred.user, { displayName }); } catch {}
  await upsertUser(cred.user, { displayName, authProvider: 'password' });
  return cred.user;
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  upsertUser(cred.user, { authProvider: 'password' }).catch(() => {});
  return cred.user;
}

// ── Google sign-in ────────────────────────────────────────
// FIX: Always try popup on desktop; fall back to redirect on any popup error.
export async function loginWithGoogle() {
  const isMobileDevice = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;

  if (isMobileDevice) {
    sessionStorage.setItem('googleRedirect', '1');
    await signInWithRedirect(auth, googleProvider);
    return null;
  }

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await upsertUser(cred.user, { authProvider: 'google' });
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
      sessionStorage.setItem('googleRedirect', '1');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

// FIX: Always call getRedirectResult — don't gate behind sessionStorage flag.
// Returns null harmlessly when no redirect happened.
export async function handleGoogleRedirect() {
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) {
      await upsertUser(result.user, { authProvider: 'google' });
      sessionStorage.removeItem('googleRedirect');
      return result.user;
    }
  } catch (err) {
    if (err.code !== 'auth/no-current-user') {
      console.error('Google redirect error:', err);
      toast('Google sign-in failed. ' + friendlyAuthError(err.code), 'error');
    }
  }
  return null;
}

// ── Logout ────────────────────────────────────────────────
export async function logout() { await signOut(auth); }

// ── Password change ───────────────────────────────────────
export async function changePassword(user, oldPassword, newPassword) {
  const credential = EmailAuthProvider.credential(user.email, oldPassword);
  await reauthenticateWithCredential(user, credential);
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
    'auth/popup-blocked':           'Popup blocked — trying redirect instead…',
    'auth/requires-recent-login':   'Please sign out and sign back in first.',
    'auth/user-disabled':           'This account has been disabled.',
  };
  return map[code] || ('Error (' + (code || 'unknown') + '). Please try again.');
}
