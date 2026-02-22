/**
 * auth-service.js  — PulseChat v3
 *
 * ROOT CAUSES FIXED:
 * 1. "Cannot read properties of null (reading 'uid')"
 *    The old code called callback(user) with a raw Supabase auth user that has
 *    no .uid field. Every page then did currentUser = user and tried
 *    currentUser.uid which was undefined, blowing up everywhere.
 *    FIX: onAuthChange now resolves the DB profile and passes THAT to the
 *    callback, so .uid is always present.
 *
 * 2. Callback fired twice (race condition)
 *    subscribeToAuth fired getSession() AND onAuthStateChange simultaneously.
 *    The second fire sometimes came with null, wiping currentUser mid-flight.
 *    FIX: Use only onAuthStateChange; seed it once with getSession manually.
 *
 * 3. profile update used dynamic import() in app.js → broke the call entirely
 *    FIX: updateUserProfile is a normal top-level export used directly.
 *
 * 4. Google OAuth: profile row wasn't created after redirect
 *    FIX: onAuthChange creates the row if missing before calling back.
 */

import { supabase, ts } from './supabase-config.js';

// ── onAuthChange ──────────────────────────────────────────────────────────────
// Calls callback(profileObject) when auth state changes.
// profileObject always has .uid and all DB fields.
// Calls callback(null) when logged out.

export const onAuthChange = (callback) => {
    let initialized = false;
    let currentId   = null;

    const process = async (session) => {
        const authUser = session?.user ?? null;

        if (!authUser) {
            currentId = null;
            callback(null);
            return;
        }

        // Don't re-process the same user twice in a row
        if (authUser.id === currentId) return;
        currentId = authUser.id;

        // Ensure DB profile row exists (critical for Google OAuth)
        let profile = await getUserProfile(authUser.id);
        if (!profile) {
            await _upsert(authUser,
                authUser.user_metadata?.full_name ||
                authUser.user_metadata?.display_name ||
                authUser.email?.split('@')[0] || 'User',
                null,
                authUser.app_metadata?.provider || 'email'
            );
            profile = await getUserProfile(authUser.id);
        }

        // Fallback if DB still fails (RLS policy issue etc)
        if (!profile) {
            profile = {
                uid:         authUser.id,
                id:          authUser.id,
                email:       authUser.email || '',
                displayName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
                username:    null,
                photoURL:    authUser.user_metadata?.avatar_url || null,
                authProvider: 'email',
                createdAt:   ts(),
                lastSeen:    ts(),
                usernameChangedAt: null,
                photoChangedAt:    null,
            };
        }

        callback(profile);
    };

    // Seed from current session first
    supabase.auth.getSession().then(({ data: { session } }) => {
        initialized = true;
        process(session);
    });

    // Then listen for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!initialized) return; // wait until getSession() has run first
        process(session);
    });

    return () => subscription.unsubscribe();
};

// ── Email/Password ────────────────────────────────────────────────────────────

export const registerWithEmail = async (email, password, displayName, username) => {
    const clean = _cleanU(username);
    if (clean) {
        if (clean.length < 3) throw new Error('Username must be at least 3 characters.');
        const { data: taken } = await supabase.from('users').select('id').eq('username', clean).maybeSingle();
        if (taken) throw new Error('That username is already taken.');
    }

    const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: displayName } }
    });
    if (error) throw _authErr(error);

    if (data.user) await _upsert(data.user, displayName, clean || null, 'email');
    return { user: data.user, success: true };
};

export const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw _authErr(error);
    return { user: data.user, success: true };
};

// ── Google OAuth ──────────────────────────────────────────────────────────────

export const signInWithGoogle = async () => {
    // redirectTo must exactly match what you add in Supabase → Auth → URL Configuration
    const redirectTo = window.location.origin + '/app.html';
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options:  { redirectTo }
    });
    if (error) throw _authErr(error);
    // Browser redirects — nothing else needed here
};

// ── Password Change ───────────────────────────────────────────────────────────

export const changePassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6)
        throw new Error('New password must be at least 6 characters.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Failed to change password.');
    return { success: true };
};

// ── Profile ───────────────────────────────────────────────────────────────────

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (error) { console.error('getUserProfile:', error.message); return null; }
    return data ? _norm(data) : null;
};

export const updateUserProfile = async (uid, updates) => {
    if (!uid) throw new Error('Not signed in.');
    const row = { last_seen: ts() };
    if (updates.displayName?.trim()) row.display_name = updates.displayName.trim();
    if (updates.photoURL !== undefined) row.photo_url = updates.photoURL;

    const { error } = await supabase.from('users').update(row).eq('id', uid);
    if (error) {
        console.error('updateUserProfile error:', error);
        throw new Error('Failed to update profile: ' + error.message);
    }
    if (updates.displayName?.trim())
        await supabase.auth.updateUser({ data: { display_name: updates.displayName.trim() } });
    return { success: true };
};

export const updateUsername = async (uid, rawUsername) => {
    if (!uid) throw new Error('Not signed in.');
    const clean = _cleanU(rawUsername);
    if (clean.length < 3) throw new Error('Username must be at least 3 characters.');

    // Cooldown check
    const { data: row } = await supabase.from('users').select('username_changed_at').eq('id', uid).maybeSingle();
    if (row?.username_changed_at) {
        const days = (Date.now() - new Date(row.username_changed_at).getTime()) / 86400000;
        if (days < 7) {
            const left = Math.ceil(7 - days);
            throw new Error(`You can change your username again in ${left} day${left !== 1 ? 's' : ''}.`);
        }
    }

    // Uniqueness
    const { data: taken } = await supabase.from('users').select('id').eq('username', clean).neq('id', uid).maybeSingle();
    if (taken) throw new Error('That username is already taken.');

    const { error } = await supabase.from('users').update({ username: clean, username_changed_at: ts() }).eq('id', uid);
    if (error) throw new Error('Failed to save username: ' + error.message);
    return { success: true, username: clean };
};

export const uploadProfilePicture = async (uid, file) => {
    if (!uid) throw new Error('Not signed in.');
    if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
    if (file.size > 3 * 1024 * 1024) throw new Error('Image must be under 3 MB.');

    // Cooldown check
    const { data: row } = await supabase.from('users').select('photo_changed_at').eq('id', uid).maybeSingle();
    if (row?.photo_changed_at) {
        const days = (Date.now() - new Date(row.photo_changed_at).getTime()) / 86400000;
        if (days < 7) {
            const left = Math.ceil(7 - days);
            throw new Error(`You can change your photo again in ${left} day${left !== 1 ? 's' : ''}.`);
        }
    }

    // Try Supabase Storage
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `avatars/${uid}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });

    let photoURL;
    if (!upErr) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        photoURL = data.publicUrl + '?v=' + Date.now();
    } else {
        // Fallback: base64 data URL stored directly in the DB column
        photoURL = await _toDataUrl(file);
    }

    const { error: dbErr } = await supabase.from('users').update({ photo_url: photoURL, photo_changed_at: ts() }).eq('id', uid);
    if (dbErr) throw new Error('Failed to save photo: ' + dbErr.message);
    return { success: true, photoURL };
};

export const updateLastSeen = async (uid) => {
    if (!uid) return;
    await supabase.from('users').update({ last_seen: ts() }).eq('id', uid);
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

// ── Internals ─────────────────────────────────────────────────────────────────

const _upsert = async (authUser, displayName, username, provider) => {
    const { error } = await supabase.from('users').upsert({
        id:            authUser.id,
        email:         authUser.email,
        display_name:  (displayName || '').trim() || authUser.email?.split('@')[0] || 'User',
        username:      username ? _cleanU(username) : null,
        photo_url:     authUser.user_metadata?.avatar_url || null,
        auth_provider: provider,
        created_at:    ts(),
        last_seen:     ts(),
    }, { onConflict: 'id' });
    if (error) console.error('_upsert:', error.message);
};

const _cleanU = (u) => (u || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

const _norm = (r) => ({
    uid:               r.id,
    id:                r.id,
    email:             r.email || '',
    displayName:       r.display_name || 'User',
    username:          r.username     || null,
    photoURL:          r.photo_url    || null,
    authProvider:      r.auth_provider,
    createdAt:         r.created_at,
    lastSeen:          r.last_seen,
    usernameChangedAt: r.username_changed_at || null,
    photoChangedAt:    r.photo_changed_at    || null,
});

const _toDataUrl = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = (e) => res(e.target.result);
    r.onerror = ()  => rej(new Error('Could not read image file.'));
    r.readAsDataURL(file);
});

const _authErr = (e) => new Error({
    'User already registered':                   'This email is already registered.',
    'Invalid login credentials':                 'Incorrect email or password.',
    'Email not confirmed':                       'Please confirm your email before signing in.',
    'Password should be at least 6 characters':  'Password must be at least 6 characters.',
    'Unable to validate email address':           'Please enter a valid email address.',
    'Too many requests':                         'Too many attempts — please wait a moment.',
}[e.message] || e.message);
