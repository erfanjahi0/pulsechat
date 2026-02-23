import { db } from './firebase.js';
import { 
  collection, query, where, orderBy, onSnapshot, 
  doc, setDoc, getDoc, updateDoc, serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Subscribe to chat list
export function subscribeChatList(uid, callback) {
  // QUERY REQUIRES INDEX: participantsMap ASC, lastMessageAt DESC
  const q = query(
    collection(db, 'chats'),
    where(`participantsMap.${uid}`, '==', true),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(chats);
  });
}

// Get or Create Chat (Fix for bug #3)
export async function getOrCreateChat(myUid, otherUid) {
  // Sort UIDs to ensure same ID regardless of who starts it
  const ids = [myUid, otherUid].sort();
  const chatId = ids.join('_');
  
  const chatRef = doc(db, 'chats', chatId);
  const snap = await getDoc(chatRef);

  if (!snap.exists()) {
    // SECURITY RULE REQUIREMENT:
    // 1. participants array must contain both UIDs
    // 2. participantsMap must have both UIDs as true
    const data = {
      participants: ids, 
      participantsMap: {
        [ids[0]]: true,
        [ids[1]]: true
      },
      lastMessageText: '',
      lastMessageAt: serverTimestamp(),
      lastMessageFrom: null,
      unreadCount: {
        [ids[0]]: 0,
        [ids[1]]: 0
      },
      typing: {}
    };
    
    // Use setDoc with merge:true to be safe, though not strictly necessary for new doc
    await setDoc(chatRef, data, { merge: true });
  }

  return chatId;
}

export async function clearUnread(chatId, myUid) {
  const ref = doc(db, 'chats', chatId);
  await updateDoc(ref, {
    [`unreadCount.${myUid}`]: 0
  });
}    where(`participantsMap.${myUid}`, '==', true),
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
