/**
 * PulseChat - Supabase Configuration
 * Initialize Supabase client for Auth and Database
 *
 * ⚙️  SETUP: Replace the two values below with your Supabase project credentials.
 *    1. Go to https://supabase.com  → New project (free, no card needed)
 *    2. Settings → API → copy "Project URL" and "anon public" key
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Your Supabase credentials ────────────────────────────────────────────────
const SUPABASE_URL  = 'https://honfzpyshuafihdmiaol.supabase.co';   // e.g. https://xxxx.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbmZ6cHlzaHVhZmloZG1pYW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQ2NDcsImV4cCI6MjA4NzM2MDY0N30.-VFXaZWubVgMxlbBl4WPh7zWHl98ZHNozsXfaL-7AvA';
// ──────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    realtime: { params: { eventsPerSecond: 10 } }
});

/**
 * Returns the currently signed-in user, or null.
 */
export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

/**
 * Subscribe to auth state changes.
 * Callback receives (event, session) — mirrors Firebase's onAuthStateChanged.
 */
export const subscribeToAuth = (callback) => {
    // Fire once immediately with current session
    supabase.auth.getSession().then(({ data: { session } }) => {
        callback(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ?? null);
    });

    // Return unsubscribe function (matches Firebase pattern)
    return () => subscription.unsubscribe();
};

/**
 * Sign out the current user.
 */
export const logoutUser = () => supabase.auth.signOut();

/**
 * Server-side "now" helper — Supabase uses ISO strings.
 * Returns a JS Date; insert as .toISOString() in DB calls.
 */
export const getServerTimestamp = () => new Date().toISOString();

export const COLLECTIONS = {
    USERS: 'users',
    CHATS: 'chats',
    MESSAGES: 'messages'
};
