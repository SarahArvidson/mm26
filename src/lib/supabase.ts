import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Diagnostic log: verify anon key format (first 3 chars should be "eyJ" for JWT)
if (supabaseAnonKey) {
  const keyPrefix = supabaseAnonKey.substring(0, 3);
  console.log('Supabase anon key prefix (first 3 chars):', keyPrefix);
  if (!keyPrefix.startsWith('eyJ')) {
    console.warn('⚠️ Key does not start with eyJ. Expected classic anon JWT key (VITE_SUPABASE_ANON_KEY).');
  }
} else {
  console.warn('VITE_SUPABASE_ANON_KEY is not set');
}

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const supabase = {
  supabase: client,
  from: client.from.bind(client),
  rpc: client.rpc.bind(client),
  getSession: () => client.auth.getSession(),
  signIn: (opts: { email: string; password: string }) =>
    client.auth.signInWithPassword({ email: opts.email, password: opts.password }),
  signOut: () => client.auth.signOut(),
  resetPassword: (opts: { email: string; redirectTo: string }) =>
    client.auth.resetPasswordForEmail(opts.email, { redirectTo: opts.redirectTo }),
};
