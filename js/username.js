// ============================================================
// username.js — Username uniqueness reservation
// ============================================================
import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, deleteDoc,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { validateUsername, cooldownDaysLeft } from './utils.js';

// ── Reserve a username atomically ────────────────────────

/**
 * Reserve a username for a UID (transaction-safe).
 * Creates  usernames/{username} = { uid }
 * Updates  users/{uid}.username + lastUsernameChange
 *
 * @param {string} uid
 * @param {string} newUsername    (already validated, lowercase)
 * @param {string|null} oldUsername  release this if set
 * @returns {Promise<void>}
 * @throws {Error} if username is taken
 */
export async function reserveUsername(uid, newUsername, oldUsername = null) {
  const newRef = doc(db, 'usernames', newUsername);
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (tx) => {
    const newSnap = await tx.get(newRef);

    // Check if taken by someone else
    if (newSnap.exists() && newSnap.data().uid !== uid) {
      throw new Error('USERNAME_TAKEN');
    }

    // Check cooldown (read current user doc)
    const userSnap = await tx.get(userRef);
    if (userSnap.exists()) {
      const left = cooldownDaysLeft(userSnap.data().lastUsernameChange, 7);
      if (left > 0) {
        throw new Error(`COOLDOWN:${left}`);
      }
    }

    // Release old username
    if (oldUsername && oldUsername !== newUsername) {
      tx.delete(doc(db, 'usernames', oldUsername));
    }

    // Reserve new username
    tx.set(newRef, { uid, reservedAt: serverTimestamp() });

    // Update user doc
    tx.update(userRef, {
      username: newUsername,
      lastUsernameChange: serverTimestamp(),
    });
  });
}

/**
 * Reserve an initial username (on signup — no cooldown check).
 * @param {string} uid
 * @param {string} username
 */
export async function reserveInitialUsername(uid, username) {
  const newRef  = doc(db, 'usernames', username);
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(newRef);
    if (snap.exists() && snap.data().uid !== uid) {
      throw new Error('USERNAME_TAKEN');
    }
    tx.set(newRef, { uid, reservedAt: serverTimestamp() });
    tx.update(userRef, { username });
  });
}

/**
 * Check if a username is available (not taken, or owned by uid).
 * @param {string} username
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
export async function isUsernameAvailable(username, uid) {
  const snap = await getDoc(doc(db, 'usernames', username));
  if (!snap.exists()) return true;
  return snap.data().uid === uid;
}

/**
 * Lookup a UID by username.
 * @param {string} username
 * @returns {Promise<string|null>}
 */
export async function lookupUidByUsername(username) {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return snap.exists() ? snap.data().uid : null;
}
