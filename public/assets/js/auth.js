import { auth, db } from './firebase.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, getDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { generateUsername } from './utils.js';

const googleProvider = new GoogleAuthProvider();

// Handle Register (Email/Pass)
export async function registerWithEmail(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const username = generateUsername(displayName);
  
  await updateProfile(user, { displayName, photoURL: null });
  
  // Create user doc
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: displayName,
    username: username,
    photoURL: null,
    authProvider: 'password',
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    lastUsernameChange: null,
    lastPhotoChange: null,
    blockedUsers: []
  });

  // Reserve username
  await setDoc(doc(db, 'usernames', username), {
    uid: user.uid,
    reservedAt: serverTimestamp()
  });

  return user;
}

// Handle Login (Email/Pass)
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

// Handle Google Login
export async function loginWithGoogle() {
  // Mobile: Redirect, PC: Popup
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    await signInWithRedirect(auth, googleProvider);
    return null; // Will redirect
  } else {
    const res = await signInWithPopup(auth, googleProvider);
    await checkGoogleUser(res.user);
    return res.user;
  }
}

// Handle Google Redirect (Call this on index.html load)
export async function handleGoogleRedirect() {
  try {
    const res = await getRedirectResult(auth);
    if (res && res.user) {
      await checkGoogleUser(res.user);
      return res.user;
    }
  } catch (error) {
    console.error("Google Redirect Error:", error);
    throw error;
  }
  return null;
}

// Helper: Create Firestore doc for Google user if new
async function checkGoogleUser(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const username = generateUsername(user.displayName || 'User');
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || 'User',
      username: username,
      photoURL: user.photoURL || null,
      authProvider: 'google',
      createdAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      lastUsernameChange: null,
      lastPhotoChange: null,
      blockedUsers: []
    });
    
    // Try to reserve username (might fail if taken, but rare for generated)
    try {
      await setDoc(doc(db, 'usernames', username), {
        uid: user.uid,
        reservedAt: serverTimestamp()
      });
    } catch (e) { console.log('Username reservation skipped'); }
  }
}

export async function logout() {
  await signOut(auth);
}

export async function changePassword(user, oldPass, newPass) {
  // Re-auth logic requires EmailAuthProvider which is complex to implement 
  // without clean import. For v2 simple version, we assume recent login 
  // or let firebase throw 'requires-recent-login'
  const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  
  const cred = EmailAuthProvider.credential(user.email, oldPass);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPass);
}

export function friendlyAuthError(code) {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/user-disabled': return 'Account disabled.';
    case 'auth/user-not-found': return 'Account not found.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/email-already-in-use': return 'Email already in use.';
    case 'auth/weak-password': return 'Password is too weak.';
    case 'auth/requires-recent-login': return 'Please sign out and sign in again.';
    default: return 'Authentication failed. Please try again.';
  }
}
