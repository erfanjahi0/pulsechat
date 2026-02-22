/**
 * PulseChat - Database Service (Supabase)
 * Replaces Firestore — same exported API surface as the original db-service.js.
 *
 * Real-time subscriptions use Supabase Realtime (Postgres Changes).
 */

import { supabase, getServerTimestamp } from './supabase-config.js';

// ============================================
// User Search
// ============================================

/**
 * Search users by display name or email.
 */
export const searchUsers = async (searchTerm, currentUserId, maxResults = 10) => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId)
        .or(`display_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(maxResults);

    if (error) { console.error('Error searching users:', error); throw error; }

    return (data || []).map(_normaliseUser);
};

/**
 * Get multiple users by IDs — returns { [id]: user } map.
 */
export const getUsersByIds = async (userIds) => {
    if (!userIds?.length) return {};

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('id', userIds);

    if (error) { console.error('Error fetching users:', error); throw error; }

    const map = {};
    (data || []).forEach(row => { map[row.id] = _normaliseUser(row); });
    return map;
};

/**
 * Get a single user by ID.
 */
export const getUserById = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) { console.error('Error fetching user:', error); return null; }
    return _normaliseUser(data);
};

// ============================================
// Chat Operations
// ============================================

/**
 * Generate a deterministic chat ID from two user IDs.
 */
export const generateChatId = (uidA, uidB) => [uidA, uidB].sort().join('_');

/**
 * Get or create a 1-on-1 chat between two users.
 * Returns the chat ID string.
 */
export const getOrCreateChat = async (currentUserId, otherUserId) => {
    const chatId = generateChatId(currentUserId, otherUserId);

    // Check if chat exists
    const { data: existing } = await supabase
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .maybeSingle();

    if (!existing) {
        const [currentUser, otherUser] = await Promise.all([
            getUserById(currentUserId),
            getUserById(otherUserId)
        ]);

        const now = getServerTimestamp();

        await supabase.from('chats').insert({
            id:                  chatId,
            participants:        [currentUserId, otherUserId],
            last_message_text:   '',
            last_message_at:     null,
            last_message_from:   null,
            unread_count:        { [currentUserId]: 0, [otherUserId]: 0 },
            user_data: {
                [currentUserId]: {
                    displayName: currentUser?.displayName || 'Unknown',
                    photoURL:    currentUser?.photoURL    || null
                },
                [otherUserId]: {
                    displayName: otherUser?.displayName || 'Unknown',
                    photoURL:    otherUser?.photoURL    || null
                }
            },
            created_at: now
        });
    }

    return chatId;
};

/**
 * Subscribe to the current user's chat list with real-time updates.
 * Returns an unsubscribe function.
 */
export const subscribeToChatList = (userId, callback) => {
    const fetchChats = async () => {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .contains('participants', [userId])
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(30);

        if (error) { console.error('Error fetching chat list:', error); callback([]); return; }
        callback((data || []).map(_normaliseChat));
    };

    fetchChats();

    // Real-time: re-fetch on any change to a relevant chat
    const channel = supabase
        .channel(`chats:user:${userId}`)
        .on('postgres_changes', {
            event:  '*',
            schema: 'public',
            table:  'chats',
            filter: `participants=cs.{${userId}}`  // contains userId
        }, () => fetchChats())
        .subscribe();

    return () => supabase.removeChannel(channel);
};

/**
 * Mark all messages in a chat as read for the given user.
 */
export const markChatAsRead = async (chatId, userId) => {
    const { data: chat } = await supabase
        .from('chats')
        .select('unread_count')
        .eq('id', chatId)
        .single();

    if (!chat) return;

    const unread = { ...(chat.unread_count || {}), [userId]: 0 };

    await supabase.from('chats').update({ unread_count: unread }).eq('id', chatId);
};

// ============================================
// Message Operations
// ============================================

/**
 * Send a text message.
 * Returns the new message ID.
 */
export const sendMessage = async (chatId, fromUserId, toUserId, text) => {
    if (!text?.trim()) return null;

    const now = getServerTimestamp();

    // Insert message
    const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
            chat_id:    chatId,
            from_user:  fromUserId,
            to_user:    toUserId,
            text:       text.trim(),
            type:       'text',
            created_at: now
        })
        .select('id')
        .single();

    if (msgErr) { console.error('Error sending message:', msgErr); throw msgErr; }

    // Update chat metadata + increment unread for recipient
    const { data: chat } = await supabase
        .from('chats')
        .select('unread_count')
        .eq('id', chatId)
        .single();

    const unread = { ...(chat?.unread_count || {}), [toUserId]: ((chat?.unread_count?.[toUserId] || 0) + 1) };

    await supabase.from('chats').update({
        last_message_text:  text.trim(),
        last_message_at:    now,
        last_message_from:  fromUserId,
        unread_count:       unread
    }).eq('id', chatId);

    return msg.id;
};

/**
 * Subscribe to messages in a chat with real-time updates.
 * Returns an unsubscribe function.
 */
export const subscribeToMessages = (chatId, callback) => {
    const fetchMessages = async () => {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (error) { console.error('Error fetching messages:', error); callback([]); return; }
        callback((data || []).map(_normaliseMessage));
    };

    fetchMessages();

    const channel = supabase
        .channel(`messages:chat:${chatId}`)
        .on('postgres_changes', {
            event:  'INSERT',
            schema: 'public',
            table:  'messages',
            filter: `chat_id=eq.${chatId}`
        }, () => fetchMessages())
        .subscribe();

    return () => supabase.removeChannel(channel);
};

/**
 * Load older messages (pagination).
 */
export const loadMoreMessages = async (chatId, lastMessage, pageSize = 30) => {
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .lt('created_at', lastMessage.createdAt)
        .order('created_at', { ascending: false })
        .limit(pageSize);

    if (error) { console.error('Error loading more messages:', error); return []; }
    return (data || []).map(_normaliseMessage).reverse();
};

// ============================================
// Internal helpers — normalise DB rows to camelCase
// ============================================

const _normaliseUser = (row) => ({
    uid:         row.id,
    id:          row.id,
    email:       row.email,
    displayName: row.display_name,
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
    // Wrap in Firestore-compatible shape so ui-renderer's .toDate() calls still work
    createdAt: row.created_at ? { toDate: () => new Date(row.created_at) } : null
});

export default {
    searchUsers,
    getUsersByIds,
    getUserById,
    generateChatId,
    getOrCreateChat,
    subscribeToChatList,
    markChatAsRead,
    sendMessage,
    subscribeToMessages,
    loadMoreMessages
};
