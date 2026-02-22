/**
 * PulseChat v2 - Supabase Configuration
 * Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY with your project credentials.
 * Settings → API in your Supabase dashboard.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://honfzpyshuafihdmiaol.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbmZ6cHlzaHVhZmloZG1pYW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQ2NDcsImV4cCI6MjA4NzM2MDY0N30.-VFXaZWubVgMxlbBl4WPh7zWHl98ZHNozsXfaL-7AvA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    realtime: { params: { eventsPerSecond: 10 } }
});

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

export const subscribeToAuth = (callback) => {
    // Immediately fire with current session
    supabase.auth.getSession().then(({ data: { session } }) => {
        callback(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
};

export const logoutUser = () => supabase.auth.signOut();
export const getServerTimestamp = () => new Date().toISOString();

export const COLLECTIONS = { USERS: 'users', CHATS: 'chats', MESSAGES: 'messages' };
