// ============================================================
// messages.js — Messages: send, subscribe, paginate
// ============================================================
import { db } from './firebase.js';
import {
  collection, addDoc, query, orderBy, limit,
  onSnapshot, serverTimestamp, startAfter,
  getDocs, doc, updateDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { updateChatMeta } from './chats.js';

const PAGE_SIZE = 30;

export async function sendMessage(chatId, fromUid, toUid, text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty message');

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    from:      fromUid,
    to:        toUid,
    text:      trimmed,
    createdAt: serverTimestamp(),
    type:      'text',
  });

  await updateChatMeta(chatId, fromUid, toUid, trimmed);
}

export function subscribeMessages(chatId, callback) {
  let resolveFirst;
  const firstLoad = new Promise(r => { resolveFirst = r; });

  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)
  );

  let resolved = false;
  const unsubscribe = onSnapshot(q, (snap) => {
    const msgs    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const lastDoc = snap.docs[snap.docs.length - 1] || null;
    callback(msgs, lastDoc);
    if (!resolved) { resolved = true; resolveFirst(); }
  }, (err) => {
    console.error('Messages error:', err);
    if (!resolved) { resolved = true; resolveFirst(); }
  });

  return { unsubscribe, firstLoad };
}

export async function loadMoreMessages(chatId, lastDoc) {
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(PAGE_SIZE)
  );
  const snap    = await getDocs(q);
  const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const newLastDoc = snap.docs[snap.docs.length - 1] || null;
  return { messages, newLastDoc };
}

// Typing indicator (ephemeral, stored on chat doc)
let _typingTimer = null;

export async function setTyping(chatId, uid, isTyping) {
  clearTimeout(_typingTimer);
  try {
    await updateDoc(doc(db, 'chats', chatId), { [`typing.${uid}`]: isTyping });
    if (isTyping) _typingTimer = setTimeout(() => setTyping(chatId, uid, false), 5000);
  } catch {}
}
