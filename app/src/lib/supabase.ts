import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/**
 * Links from invite / password-recovery e-mails arrive as #...&type=invite|recovery.
 * Read it before supabase-js consumes the hash, so the app can ask for a new password.
 */
export const passwordLinkType: 'invite' | 'recovery' | null = (() => {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.hash.slice(1)).get('type');
  return t === 'invite' || t === 'recovery' ? t : null;
})();

/**
 * Supabase client, or null when the env vars are missing. Without Supabase the app
 * runs in demo mode on the prototype's sample data (useful for design review).
 */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

export const isLive = supabase !== null;
