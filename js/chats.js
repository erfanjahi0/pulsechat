// ============================================================
// chats.js — Chat list, creation, unread counts
// ============================================================
import { db } from './firebase.js';
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, query, where, orderBy, limit,
  serverTimestamp, increment,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function getChatId(uidA, uidB) {
  return [uidA, uidB].sort().join('_');
}

export async function getOrCreateChat(myUid, otherUid) {
  const chatId = getChatId(myUid, otherUid);
  const ref    = doc(db, 'chats', chatId);
  const snap   = await getDoc(ref);

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

  return chatId;
}

export function subscribeChatList(myUid, callback) {
  const q = query(
    collection(db, 'chats'),
    where(`participantsMap.${myUid}`, '==', true),
    orderBy('lastMessageAt', 'desc'),
    limit(30)
  );

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (err) => console.error('Chat list error:', err));
}

export async function clearUnread(chatId, myUid) {
  try {
    await updateDoc(doc(db, 'chats', chatId), { [`unreadCount.${myUid}`]: 0 });
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
