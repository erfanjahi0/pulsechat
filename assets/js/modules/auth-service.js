/**
 * PulseChat - Authentication Service (Supabase)
 * Replaces Firebase Auth — same exported API surface.
 */

import {
    supabase,
    subscribeToAuth,
    logoutUser,
    getServerTimestamp
} from './supabase-config.js';

// ============================================
// Email / Password Authentication
// ============================================

/**
 * Register new user with email and password.
 */
export const registerWithEmail = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
    });

    if (error) throw handleAuthError(error);

    const user = data.user;
    await _upsertUserProfile(user, displayName, 'password');

    return { user, success: true };
};

/**
 * Login with email and password.
 */
export const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw handleAuthError(error);
    return { user: data.user, success: true };
};

// ============================================
// Google OAuth
// ============================================

/**
 * Sign in with Google (redirect flow — works on all devices).
 * After redirect, Supabase automatically handles the callback and
 * triggers onAuthStateChange. The profile row is created there.
 */
export const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/app.html'
        }
    });
    if (error) throw handleAuthError(error);
    return { success: true };
};

// ============================================
// User Profile Management
// ============================================

/** Internal: upsert a row in public.users */
const _upsertUserProfile = async (user, displayName, authProvider) => {
    const now = getServerTimestamp();
    const { error } = await supabase.from('users').upsert({
        id:            user.id,
        email:         user.email,
        display_name:  displayName
                         || user.user_metadata?.display_name
                         || user.user_metadata?.full_name
                         || 'Anonymous',
        photo_url:     user.user_metadata?.avatar_url || null,
        auth_provider: authProvider,
        created_at:    now,
        last_seen:     now
    }, { onConflict: 'id' });

    if (error) console.error('Error upserting user profile:', error);
};

/**
 * Get user profile data from public.users.
 */
export const getUserProfile = async (uid) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

    if (error) {
        if (error.code !== 'PGRST116') console.error('Error fetching user profile:', error);
        return null;
    }

    return _normaliseUser(data);
};

/**
 * Update user profile.
 * @param {string} uid
 * @param {object} updates  e.g. { displayName: 'Alice' }
 */
export const updateUserProfile = async (uid, updates) => {
    const dbUpdates = { last_seen: getServerTimestamp() };
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.photoURL    !== undefined) dbUpdates.photo_url    = updates.photoURL;

    const { error } = await supabase.from('users').update(dbUpdates).eq('id', uid);
    if (error) throw error;

    if (updates.displayName) {
        await supabase.auth.updateUser({ data: { display_name: updates.displayName } });
    }

    return { success: true };
};

/** Update last_seen timestamp. */
export const updateLastSeen = async (uid) => {
    await supabase.from('users').update({ last_seen: getServerTimestamp() }).eq('id', uid);
};

// ============================================
// Logout
// ============================================

export const signOut = async () => {
    const { error } = await logoutUser();
    if (error) throw error;
};

// ============================================
// Auth State
// ============================================

/**
 * Subscribe to auth state changes.
 * Callback receives user object (or null). Returns unsubscribe fn.
 * Also ensures profile row exists after Google OAuth redirect.
 */
export const onAuthChange = (callback) => {
    return subscribeToAuth(async (user) => {
        if (user) {
            const existing = await getUserProfile(user.id);
            if (!existing) {
                await _upsertUserProfile(
                    user,
                    user.user_metadata?.full_name || user.user_metadata?.display_name || 'User',
                    user.app_metadata?.provider || 'password'
                );
            }
        }
        callback(user);
    });
};

// ============================================
// Error Handling
// ============================================

const handleAuthError = (error) => {
    const map = {
        'User already registered':                   'This email is already registered.',
        'Invalid login credentials':                 'Incorrect email or password.',
        'Email not confirmed':                       'Please check your email to confirm your account.',
        'Password should be at least 6 characters': 'Password must be at least 6 characters.',
        'Unable to validate email address':          'Invalid email address.',
        'Too many requests':                         'Too many attempts. Please try again later.'
    };
    return new Error(map[error.message] || error.message);
};

/** Convert snake_case DB row → camelCase app object. */
const _normaliseUser = (row) => ({
    uid:          row.id,
    id:           row.id,
    email:        row.email,
    displayName:  row.display_name,
    photoURL:     row.photo_url,
    authProvider: row.auth_provider,
    createdAt:    row.created_at,
    lastSeen:     row.last_seen
});

export default {
    registerWithEmail,
    loginWithEmail,
    signInWithGoogle,
    getUserProfile,
    updateUserProfile,
    updateLastSeen,
    signOut,
    onAuthChange
};
