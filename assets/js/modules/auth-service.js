/**
 * PulseChat v2 - Auth Service
 * FIXES:
 *  - updateUserProfile: better error surfacing
 *  - onAuthChange: fires callback only after profile is ready
 *  - Google OAuth: proper redirect
 * NEW:
 *  - updatePassword: requires old password verification first
 */

import { supabase, subscribeToAuth, logoutUser, getServerTimestamp } from './supabase-config.js';

// ── Email / Password ────────────────────────────────────────────────────────

export const registerWithEmail = async (email, password, displayName, username) => {
    if (username) {
        const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
        const { data: existing } = await supabase
            .from('users').select('id').eq('username', clean).maybeSingle();
        if (existing) throw new Error('That username is already taken. Try another one.');
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
    });

    if (error) throw handleAuthError(error);

    const user = data.user;
    if (user) {
        await _upsertUserProfile(user, displayName, username, 'password');
    }

    return { user, success: true };
};

export const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw handleAuthError(error);
    return { user: data.user, success: true };
};

// ── Google OAuth ─────────────────────────────────────────────────────────────

export const signInWithGoogle = async () => {
    // Build the redirect URL: works for both local dev and production
    const redirectTo = window.location.origin +
        (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/app.html';

    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });
    if (error) throw handleAuthError(error);
    // Browser redirects — nothing more to do here
};

// ── Profile Management ───────────────────────────────────────────────────────

const _upsertUserProfile = async (user, displayName, username, authProvider) => {
    const now = getServerTimestamp();
    const cleanUsername = username
        ? username.toLowerCase().replace(/[^a-z0-9_]/g, '')
        : null;

    const { error } = await supabase.from('users').upsert({
        id:           user.id,
        email:        user.email,
        display_name: displayName
                        || user.user_metadata?.display_name
                        || user.user_metadata?.full_name
                        || 'User',
        username:     cleanUsername,
        photo_url:    user.user_metadata?.avatar_url || null,
        auth_provider: authProvider,
        created_at:   now,
        last_seen:    now
    }, { onConflict: 'id' });

    if (error) console.error('Upsert profile error:', error.message, error.details);
};

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    const { data, error } = await supabase
        .from('users').select('*').eq('id', uid).single();

    if (error) {
        if (error.code !== 'PGRST116') console.error('getUserProfile error:', error.message);
        return null;
    }
    return _normaliseUser(data);
};

/**
 * Update display name and/or photo URL.
 */
export const updateUserProfile = async (uid, updates) => {
    if (!uid) throw new Error('Not authenticated.');
    const dbUpdates = { last_seen: getServerTimestamp() };
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.photoURL    !== undefined) dbUpdates.photo_url    = updates.photoURL;

    const { error } = await supabase.from('users').update(dbUpdates).eq('id', uid);
    if (error) {
        console.error('updateUserProfile error:', error.message, error.code, error.details);
        if (error.code === '42501') throw new Error('Permission denied. Are you logged in?');
        throw new Error('Failed to save profile — ' + (error.message || 'please try again.'));
    }

    if (updates.displayName) {
        await supabase.auth.updateUser({ data: { display_name: updates.displayName } });
    }

    return { success: true };
};

/**
 * Update username — enforces once-per-week cooldown.
 */
export const updateUsername = async (uid, newUsername) => {
    if (!uid) throw new Error('Not authenticated.');
    const clean = newUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3) throw new Error('Username must be at least 3 characters.');

    const { data: current } = await supabase
        .from('users').select('username_changed_at').eq('id', uid).single();

    if (current?.username_changed_at) {
        const days = (Date.now() - new Date(current.username_changed_at).getTime()) / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            throw new Error(`You can change your username again in ${remaining} day${remaining > 1 ? 's' : ''}.`);
        }
    }

    const { data: existing } = await supabase
        .from('users').select('id').eq('username', clean).neq('id', uid).maybeSingle();
    if (existing) throw new Error('That username is already taken.');

    const { error } = await supabase.from('users').update({
        username: clean,
        username_changed_at: getServerTimestamp()
    }).eq('id', uid);

    if (error) {
        console.error('updateUsername error:', error.message);
        throw new Error('Failed to update username. Please try again.');
    }
    return { success: true, username: clean };
};

/**
 * Upload profile picture to Supabase Storage and update user row.
 * Falls back to base64 data URL if storage bucket is unavailable.
 * Enforces once-per-week cooldown.
 */
export const uploadProfilePicture = async (uid, file) => {
    if (!uid) throw new Error('Not authenticated.');

    const { data: current } = await supabase
        .from('users').select('photo_changed_at').eq('id', uid).single();

    if (current?.photo_changed_at) {
        const days = (Date.now() - new Date(current.photo_changed_at).getTime()) / 86400000;
        if (days < 7) {
            const remaining = Math.ceil(7 - days);
            throw new Error(`You can change your photo again in ${remaining} day${remaining > 1 ? 's' : ''}.`);
        }
    }

    if (!file.type.startsWith('image/')) throw new Error('Please select an image file.');
    if (file.size > 2 * 1024 * 1024) throw new Error('Image must be smaller than 2 MB.');

    const ext  = file.name.split('.').pop();
    const path = `avatars/${uid}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
        // Storage bucket not set up — fall back to base64 stored in DB
        return await _storeAvatarAsDataUrl(uid, file);
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const photoURL = urlData.publicUrl + '?t=' + Date.now();

    const { error: updateError } = await supabase.from('users').update({
        photo_url: photoURL,
        photo_changed_at: getServerTimestamp()
    }).eq('id', uid);

    if (updateError) throw new Error('Failed to save profile picture.');
    return { success: true, photoURL };
};

/** Fallback: store avatar as data URL if storage is unavailable */
const _storeAvatarAsDataUrl = (uid, file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const { error } = await supabase.from('users').update({
            photo_url: dataUrl,
            photo_changed_at: getServerTimestamp()
        }).eq('id', uid);
        if (error) { reject(new Error('Failed to save profile picture.')); return; }
        resolve({ success: true, photoURL: dataUrl });
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
});

/**
 * Change password — verifies old password first, then updates.
 */
export const updatePassword = async (email, oldPassword, newPassword) => {
    if (!email)       throw new Error('Cannot determine your email. Please log out and back in.');
    if (!oldPassword) throw new Error('Please enter your current password.');
    if (!newPassword) throw new Error('Please enter a new password.');
    if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
    if (oldPassword === newPassword) throw new Error('New password must be different from current password.');

    // Step 1: Re-authenticate to verify old password
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword
    });
    if (signInError) {
        if (signInError.message?.toLowerCase().includes('invalid')) {
            throw new Error('Current password is incorrect.');
        }
        throw new Error('Could not verify your identity. Please try again.');
    }

    // Step 2: Update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
        console.error('updatePassword error:', updateError.message);
        throw new Error('Failed to update password. Please try again.');
    }

    return { success: true };
};

export const updateLastSeen = async (uid) => {
    if (!uid) return;
    await supabase.from('users').update({ last_seen: getServerTimestamp() }).eq('id', uid);
};

// ── Sign Out ─────────────────────────────────────────────────────────────────

export const signOut = async () => {
    const { error } = await logoutUser();
    if (error) throw error;
};

// ── Auth State ────────────────────────────────────────────────────────────────
// FIX: callback now only fires AFTER profile row is guaranteed to exist.

export const onAuthChange = (callback) => {
    let lastUserId = null;

    return subscribeToAuth(async (user) => {
        if (user && user.id !== lastUserId) {
            lastUserId = user.id;
            const existing = await getUserProfile(user.id);
            if (!existing) {
                await _upsertUserProfile(
                    user,
                    user.user_metadata?.full_name || user.user_metadata?.display_name || 'User',
                    null,
                    user.app_metadata?.provider || 'google'
                );
            }
        }
        if (!user) lastUserId = null;
        callback(user);
    });
};

// ── Error Mapping ─────────────────────────────────────────────────────────────

const handleAuthError = (error) => {
    const map = {
        'User already registered':                   'This email is already registered.',
        'Invalid login credentials':                 'Incorrect email or password.',
        'Email not confirmed':                       'Please check your email and confirm your account first.',
        'Password should be at least 6 characters': 'Password must be at least 6 characters.',
        'Unable to validate email address':          'Please enter a valid email address.',
        'Too many requests':                         'Too many attempts. Please wait a moment and try again.',
        'Unsupported provider':                      'Google sign-in is not enabled. Please enable the Google provider in your Supabase Auth settings.',
    };
    for (const [key, msg] of Object.entries(map)) {
        if (error.message?.includes(key)) return new Error(msg);
    }
    return new Error(error.message || 'Something went wrong. Please try again.');
};

// ── Normalise ─────────────────────────────────────────────────────────────────

const _normaliseUser = (row) => ({
    uid:               row.id,
    id:                row.id,
    email:             row.email,
    displayName:       row.display_name,
    username:          row.username,
    photoURL:          row.photo_url,
    authProvider:      row.auth_provider,
    createdAt:         row.created_at,
    lastSeen:          row.last_seen,
    usernameChangedAt: row.username_changed_at,
    photoChangedAt:    row.photo_changed_at
});

export default {
    registerWithEmail, loginWithEmail, signInWithGoogle,
    getUserProfile, updateUserProfile, updateUsername,
    uploadProfilePicture, updatePassword,
    updateLastSeen, signOut, onAuthChange
};
