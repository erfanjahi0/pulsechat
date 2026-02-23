// ============================================================
// users.js — User queries, profile updates
// ============================================================
import { db } from './firebase.js';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, getDocs, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { lookupUidByUsername } from './username.js';

// ── Get user ──────────────────────────────────────────────

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
}

// ── Update profile ────────────────────────────────────────

/**
 * Update display name (no limit).
 * @param {string} uid
 * @param {{ displayName?: string, photoURL?: string }} fields
 */
export async function updateUserProfile(uid, fields) {
  const data = { ...fields, lastSeen: serverTimestamp() };
  await updateDoc(doc(db, 'users', uid), data);
}

/**
 * Update profile photo (once per week enforced in profile.html logic).
 * @param {string} uid
 * @param {string} photoURL  data URL or https URL
 */
export async function updateProfilePhoto(uid, photoURL) {
  await updateDoc(doc(db, 'users', uid), {
    photoURL,
    lastPhotoChange: serverTimestamp(),
  });
}

// ── Last seen ─────────────────────────────────────────────

export async function touchLastSeen(uid) {
  try { await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }); }
  catch {}
}

// ── Search by username or email ───────────────────────────

/**
 * Find users by @username or email address.
 * - If term starts with '@' → strip prefix and lookup by username
 * - If term contains '@' → exact email match
 * - Otherwise → treat as username prefix
 *
 * NEVER searches by displayName.
 *
 * @param {string} term
 * @param {string} currentUid
 * @returns {Promise<Object[]>}
 */
export async function searchUsers(term, currentUid) {
  const raw = term.trim();
  if (!raw) return [];

  const results = [];

  // Case 1: looks like an email
  if (raw.includes('@') && raw.includes('.')) {
    const q = query(
      collection(db, 'users'),
      where('email', '==', raw.toLowerCase()),
      limit(5)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      if (d.id !== currentUid) results.push({ uid: d.id, ...d.data() });
    });
    return results;
  }

  // Case 2: username lookup (strip leading @ if present)
  const uname = raw.startsWith('@') ? raw.slice(1).toLowerCase() : raw.toLowerCase();

  // Exact match first
  const exactUid = await lookupUidByUsername(uname);
  if (exactUid && exactUid !== currentUid) {
    const u = await getUser(exactUid);
    if (u) results.push(u);
  }

  // Prefix range query for partial match (up to 8 results)
  if (results.length < 8) {
    const end = uname + '\uf8ff';
    const q = query(
      collection(db, 'users'),
      where('username', '>=', uname),
      where('username', '<=', end),
      limit(10)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      if (d.id !== currentUid && !results.find(r => r.uid === d.id)) {
        results.push({ uid: d.id, ...d.data() });
      }
    });
  }

  return results.slice(0, 8);
}

// ── Block / unblock ───────────────────────────────────────

/**
 * Block a user.
 * @param {string} myUid
 * @param {string} targetUid
 */
export async function blockUser(myUid, targetUid) {
  await updateDoc(doc(db, 'users', myUid), {
    blockedUsers: arrayUnion(targetUid),
  });
}

/**
 * Unblock a user.
 * @param {string} myUid
 * @param {string} targetUid
 */
export async function unblockUser(myUid, targetUid) {
  await updateDoc(doc(db, 'users', myUid), {
    blockedUsers: arrayRemove(targetUid),
  });
}

/**
 * Check if myUid has blocked targetUid, or targetUid has blocked myUid.
 * @param {string} myUid
 * @param {string} targetUid
 * @returns {Promise<{ iBlocked: boolean, theyBlocked: boolean }>}
 */
export async function getBlockStatus(myUid, targetUid) {
  const [me, them] = await Promise.all([getUser(myUid), getUser(targetUid)]);
  const iBlocked    = (me?.blockedUsers   || []).includes(targetUid);
  const theyBlocked = (them?.blockedUsers || []).includes(myUid);
  return { iBlocked, theyBlocked };
}
