// ============================================================
// users.js — User queries, search, block/unblock (FIXED v2)
// ============================================================
import { db } from './firebase.js';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, query, where, getDocs, limit, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Get user ──────────────────────────────────────────────
export async function getUser(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.error('getUser error:', e);
    return null;
  }
}

// ── Update display name ───────────────────────────────────
export async function updateUserProfile(uid, fields) {
  await updateDoc(doc(db, 'users', uid), {
    ...fields,
    lastSeen: serverTimestamp(),
  });
}

// FIX: Don't update Firebase Auth photoURL — Auth rejects base64 data URLs.
// Only write to Firestore. The avatar builder reads from Firestore profile.
export async function updateProfilePhoto(uid, photoURL) {
  await updateDoc(doc(db, 'users', uid), {
    photoURL,
    lastPhotoChange: serverTimestamp(),
  });
}

// ── Last seen ─────────────────────────────────────────────
export async function touchLastSeen(uid) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() });
  } catch {}
}

// ── Search by @username or email (NEVER by display name) ─
export async function searchUsers(term, currentUid) {
  const raw = (term || '').trim();
  if (!raw || raw.length < 2) return [];

  const results = [];

  try {
    // ── Case 1: looks like an email ──────────────────────
    if (raw.includes('@') && raw.includes('.') && !raw.startsWith('@')) {
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

    // ── Case 2: username lookup ──────────────────────────
    const uname = raw.startsWith('@') ? raw.slice(1).toLowerCase() : raw.toLowerCase();

    if (uname.length < 1) return [];

    // Prefix range query (single-field index, auto-created by Firestore)
    const end = uname + '\uf8ff';
    const q = query(
      collection(db, 'users'),
      where('username', '>=', uname),
      where('username', '<=', end),
      limit(12)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(d => {
      if (d.id !== currentUid) {
        results.push({ uid: d.id, ...d.data() });
      }
    });
  } catch (e) {
    console.error('searchUsers error:', e);
    // Return empty rather than crashing
  }

  return results.slice(0, 8);
}

// ── Block / Unblock ───────────────────────────────────────
export async function blockUser(myUid, targetUid) {
  await updateDoc(doc(db, 'users', myUid), {
    blockedUsers: arrayUnion(targetUid),
  });
}

export async function unblockUser(myUid, targetUid) {
  await updateDoc(doc(db, 'users', myUid), {
    blockedUsers: arrayRemove(targetUid),
  });
}

export async function getBlockStatus(myUid, targetUid) {
  try {
    const [me, them] = await Promise.all([getUser(myUid), getUser(targetUid)]);
    const iBlocked    = (me?.blockedUsers   || []).includes(targetUid);
    const theyBlocked = (them?.blockedUsers || []).includes(myUid);
    return { iBlocked, theyBlocked };
  } catch {
    return { iBlocked: false, theyBlocked: false };
  }
}
