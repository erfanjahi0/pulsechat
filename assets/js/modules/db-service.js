/**
 * PulseChat v2 - Database Service
 * Updated: search by username or email only (not display name)
 */

import { supabase, getServerTimestamp } from './supabase-config.js';

// ── User Search ───────────────────────────────────────────────────────────────

/**
 * Search users by @username or email only.
 */
export const searchUsers = async (searchTerm, currentUserId, maxResults = 10) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const term = searchTerm.replace(/^@/, '').toLowerCase();

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId)
        .or(`username.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(maxResults);

    if (error) { console.error('searchUsers error:', error); return []; }
    return (data || []).map(_normaliseUser);
};

export const getUsersByIds = async (userIds) => {
    if (!userIds?.length) return {};
    const { data, error } = await supabase
        .from('users').select('*').in('id', userIds);
    if (error) { console.error('getUsersByIds error:', error); return {}; }
    const map = {};
    (data || []).forEach(row => { map[row.id] = _normaliseUser(row); });
    return map;
};

export const getUserById = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
        .from('users').select('*').eq('id', userId).single();
    if (error) { return null; }
    return _normaliseUser(data);
};

// ── Chats ─────────────────────────────────────────────────────────────────────

export const generateChatId = (uidA, uidB) => [uidA, uidB].sort().join('_');

export const getOrCreateChat = async (currentUserId, otherUserId) => {
    const chatId = generateChatId(currentUserId, otherUserId);

    const { data: existing } = await supabase
        .from('chats').select('id').eq('id', chatId).maybeSingle();

    if (!existing) {
        const [cu, ou] = await Promise.all([getUserById(currentUserId), getUserById(otherUserId)]);
        const now = getServerTimestamp();
        const { error } = await supabase.from('chats').insert({
            id: chatId,
            participants: [currentUserId, otherUserId],
            last_message_text: '',
            last_message_at: null,
            last_message_from: null,
            unread_count: { [currentUserId]: 0, [otherUserId]: 0 },
            user_data: {
                [currentUserId]: { displayName: cu?.displayName || 'Unknown', photoURL: cu?.photoURL || null },
                [otherUserId]:   { displayName: ou?.displayName || 'Unknown', photoURL: ou?.photoURL || null }
            },
            created_at: now
        });
        if (error) { console.error('getOrCreateChat error:', error); throw error; }
    }

    return chatId;
};

export const subscribeToChatList = (userId, callback) => {
    const fetchChats = async () => {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .contains('participants', [userId])
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(50);

        if (error) { console.error('subscribeToChatList error:', error); callback([]); return; }
        callback((data || []).map(_normaliseChat));
    };

    fetchChats();

    const channel = supabase
        .channel(`chats_user_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, fetchChats)
        .subscribe();

    return () => supabase.removeChannel(channel);
};

export const markChatAsRead = async (chatId, userId) => {
    const { data: chat } = await supabase
        .from('chats').select('unread_count').eq('id', chatId).single();
    if (!chat) return;
    const unread = { ...(chat.unread_count || {}), [userId]: 0 };
    await supabase.from('chats').update({ unread_count: unread }).eq('id', chatId);
};

// ── Messages ──────────────────────────────────────────────────────────────────

export const sendMessage = async (chatId, fromUserId, toUserId, text) => {
    if (!text?.trim()) return null;
    const now = getServerTimestamp();

    const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, from_user: fromUserId, to_user: toUserId, text: text.trim(), type: 'text', created_at: now })
        .select('id').single();

    if (msgErr) { console.error('sendMessage error:', msgErr); throw msgErr; }

    const { data: chat } = await supabase
        .from('chats').select('unread_count').eq('id', chatId).single();

    const unread = { ...(chat?.unread_count || {}), [toUserId]: ((chat?.unread_count?.[toUserId] || 0) + 1) };

    await supabase.from('chats').update({
        last_message_text: text.trim(),
        last_message_at: now,
        last_message_from: fromUserId,
        unread_count: unread
    }).eq('id', chatId);

    return msg.id;
};

export const subscribeToMessages = (chatId, callback) => {
    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages').select('*').eq('chat_id', chatId)
            .order('created_at', { ascending: true });
        if (error) { console.error('subscribeToMessages error:', error); callback([]); return; }
        callback((data || []).map(_normaliseMessage));
    };

    fetchMessages();

    const channel = supabase
        .channel(`messages_chat_${chatId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, fetchMessages)
        .subscribe();

    return () => supabase.removeChannel(channel);
};

export const loadMoreMessages = async (chatId, lastMessage, pageSize = 30) => {
    const { data, error } = await supabase
        .from('messages').select('*').eq('chat_id', chatId)
        .lt('created_at', lastMessage.createdAt)
        .order('created_at', { ascending: false })
        .limit(pageSize);
    if (error) return [];
    return (data || []).map(_normaliseMessage).reverse();
};

// ── Normalise ─────────────────────────────────────────────────────────────────

const _normaliseUser = (row) => ({
    uid:         row.id, id: row.id,
    email:       row.email,
    displayName: row.display_name,
    username:    row.username,
    photoURL:    row.photo_url,
    lastSeen:    row.last_seen,
    createdAt:   row.created_at
});

const _normaliseChat = (row) => ({
    id:              row.id,
    participants:    row.participants,
    participantsMap: Object.fromEntries((row.participants || []).map(id => [id, true])),
    lastMessageText: row.last_message_text,
    lastMessageAt:   row.last_message_at ? { toDate: () => new Date(row.last_message_at) } : null,
    lastMessageFrom: row.last_message_from,
    unreadCount:     row.unread_count || {},
    userData:        row.user_data    || {},
    createdAt:       row.created_at
});

const _normaliseMessage = (row) => ({
    id:        row.id,
    from:      row.from_user,
    to:        row.to_user,
    text:      row.text,
    type:      row.type,
    createdAt: row.created_at ? { toDate: () => new Date(row.created_at) } : null
});

export default {
    searchUsers, getUsersByIds, getUserById,
    generateChatId, getOrCreateChat, subscribeToChatList,
    markChatAsRead, sendMessage, subscribeToMessages, loadMoreMessages
};
