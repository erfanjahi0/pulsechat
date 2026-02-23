// ============================================================
// chats.js — Chat management (FIXED v2)
// ============================================================
// FIX: Removed orderBy('lastMessageAt') from the chat list query.
// That combination with a dynamic where() on participantsMap
// requires a Firestore composite index that most users won't have.
// We now sort client-side instead — no index needed.
import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, limit,
  serverTimestamp, increment,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function getChatId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

export async function getOrCreateChat(myUid, otherUid) {
  const chatId = getChatId(myUid, otherUid);
  const ref    = doc(db, 'chats', chatId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        participants:    [myUid, otherUid],
        participantsMap: { [myUid]: true, [otherUid]: true },
        lastMessageText: '',
        lastMessageAt:   serverTimestamp(),
        lastMessageFrom: null,
        unreadCount:     { [myUid]: 0, [otherUid]: 0 },
      });
    }
  } catch (e) {
    console.error('getOrCreateChat error:', e);
    throw e;
  }

  return chatId;
}

// FIX: No orderBy — sort client-side to avoid required composite index.
export function subscribeChatList(myUid, callback) {
  const q = query(
    collection(db, 'chats'),
    where(`participantsMap.${myUid}`, '==', true),
    limit(50)
  );

  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Sort by lastMessageAt descending (client-side)
    chats.sort((a, b) => {
      const at = a.lastMessageAt?.seconds ?? 0;
      const bt = b.lastMessageAt?.seconds ?? 0;
      return bt - at;
    });

    callback(chats.slice(0, 30));
  }, (err) => {
    console.error('Chat list subscription error:', err);
    // Surface index error to user
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      callback(null, 'INDEX_MISSING');
    } else {
      callback(null, err.message);
    }
  });
}

export async function clearUnread(chatId, myUid) {
  try {
    await updateDoc(doc(db, 'chats', chatId), {
      [`unreadCount.${myUid}`]: 0,
    });
  } catch {}
}

export async function updateChatMeta(chatId, senderUid, receiverUid, text) {
  const preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessageText: preview,
    lastMessageAt:   serverTimestamp(),
    lastMessageFrom: senderUid,
    [`unreadCount.${receiverUid}`]: increment(1),
  });
}

export async function getChat(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
