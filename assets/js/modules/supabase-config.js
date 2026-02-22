import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── REPLACE THESE TWO VALUES ────────────────────────────────────────────────
const SUPABASE_URL  = 'https://honfzpyshuafihdmiaol.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbmZ6cHlzaHVhZmloZG1pYW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODQ2NDcsImV4cCI6MjA4NzM2MDY0N30.-VFXaZWubVgMxlbBl4WPh7zWHl98ZHNozsXfaL-7AvA';
// ─────────────────────────────────────────────────────────────────────────────

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
export const ts = () => new Date().toISOString();
