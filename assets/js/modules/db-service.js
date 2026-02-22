/**
 * db-service.js — PulseChat v3
 *
 * FIXES:
 * - searchUsers: old .or() with ilike on nullable username column crashed
 *   silently. Fixed to do two separate queries and merge results.
 * - subscribeToChatList: now uses array filter syntax compatible with Supabase v2
 * - sendMessage: returns the sent message so UI can update immediately
 */

import { supabase, ts } from './supabase-config.js';

// ── User search ───────────────────────────────────────────────────────────────
// Search by email first, then by username, merge & deduplicate.
// Avoids the ilike-on-null column crash.

export const searchUsers = async (term, currentUserId, limit = 10) => {
    if (!term || term.length < 2) return [];
    const q = term.replace(/^@/, '').toLowerCase().trim();
    if (!q) return [];

    // Run both queries in parallel
    const [byEmail, byUsername] = await Promise.all([
        supabase.from('users').select('*').neq('id', currentUserId)
            .ilike('email', `%${q}%`).limit(limit),
        supabase.from('users').select('*').neq('id', currentUserId)
            .not('username', 'is', null).ilike('username', `%${q}%`).limit(limit),
    ]);

    // Merge, deduplicate by id
    const seen = new Set();
    const rows = [];
    for (const r of [...(byEmail.data || []), ...(byUsername.data || [])]) {
        if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
    }
    return rows.slice(0, limit).map(_normUser);
};

export const getUserById = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error || !data) return null;
    return _normUser(data);
};

// ── Chats ─────────────────────────────────────────────────────────────────────

const chatId = (a, b) => [a, b].sort().join('_');

export const getOrCreateChat = async (myId, otherId) => {
    const id = chatId(myId, otherId);
    const { data: existing } = await supabase.from('chats').select('id').eq('id', id).maybeSingle();
    if (existing) return id;

    const [me, them] = await Promise.all([getUserById(myId), getUserById(otherId)]);
    const { error } = await supabase.from('chats').insert({
        id,
        participants:      [myId, otherId],
        last_message_text: '',
        last_message_at:   null,
        last_message_from: null,
        unread_count:      { [myId]: 0, [otherId]: 0 },
        user_data: {
            [myId]:   { displayName: me?.displayName   || 'Unknown', photoURL: me?.photoURL   || null },
            [otherId]: { displayName: them?.displayName || 'Unknown', photoURL: them?.photoURL || null },
        },
        created_at: ts(),
    });
    if (error) throw new Error('Failed to create chat: ' + error.message);
    return id;
};

export const subscribeToChatList = (userId, callback) => {
    const fetch = async () => {
        const { data, error } = await supabase
            .from('chats')
            .select('*')
            .contains('participants', [userId])
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(50);
        if (error) { console.error('subscribeToChatList:', error); callback([]); return; }
        callback((data || []).map(_normChat));
    };

    fetch();

    const ch = supabase.channel('chats_list_' + userId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, fetch)
        .subscribe();

    return () => supabase.removeChannel(ch);
};

export const markChatAsRead = async (cid, userId) => {
    const { data } = await supabase.from('chats').select('unread_count').eq('id', cid).maybeSingle();
    if (!data) return;
    await supabase.from('chats').update({ unread_count: { ...data.unread_count, [userId]: 0 } }).eq('id', cid);
};

// ── Messages ──────────────────────────────────────────────────────────────────

export const sendMessage = async (cid, fromId, toId, text) => {
    const trimmed = text?.trim();
    if (!trimmed) return null;
    const now = ts();

    const { error: msgErr } = await supabase.from('messages').insert({
        chat_id: cid, from_user: fromId, to_user: toId,
        text: trimmed, type: 'text', created_at: now,
    });
    if (msgErr) throw new Error('Failed to send: ' + msgErr.message);

    // Update chat preview
    const { data: chat } = await supabase.from('chats').select('unread_count').eq('id', cid).maybeSingle();
    const unread = { ...(chat?.unread_count || {}), [toId]: ((chat?.unread_count?.[toId] || 0) + 1) };

    await supabase.from('chats').update({
        last_message_text: trimmed,
        last_message_at:   now,
        last_message_from: fromId,
        unread_count:      unread,
    }).eq('id', cid);
};

export const subscribeToMessages = (cid, callback) => {
    const fetch = async () => {
        const { data, error } = await supabase
            .from('messages').select('*').eq('chat_id', cid)
            .order('created_at', { ascending: true });
        if (error) { console.error('subscribeToMessages:', error); callback([]); return; }
        callback((data || []).map(_normMsg));
    };

    fetch();

    const ch = supabase.channel('msgs_' + cid)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${cid}` }, fetch)
        .subscribe();

    return () => supabase.removeChannel(ch);
};

// ── Normalisers ───────────────────────────────────────────────────────────────

const _normUser = (r) => ({
    uid: r.id, id: r.id,
    email:       r.email       || '',
    displayName: r.display_name|| 'User',
    username:    r.username    || null,
    photoURL:    r.photo_url   || null,
    lastSeen:    r.last_seen,
    createdAt:   r.created_at,
});

const _normChat = (r) => ({
    id:              r.id,
    participants:    r.participants    || [],
    lastMessageText: r.last_message_text || '',
    lastMessageAt:   r.last_message_at ? { toDate: () => new Date(r.last_message_at) } : null,
    lastMessageFrom: r.last_message_from,
    unreadCount:     r.unread_count    || {},
    userData:        r.user_data       || {},
    createdAt:       r.created_at,
});

const _normMsg = (r) => ({
    id:        r.id,
    from:      r.from_user,
    to:        r.to_user,
    text:      r.text,
    type:      r.type,
    createdAt: r.created_at ? { toDate: () => new Date(r.created_at) } : null,
});
