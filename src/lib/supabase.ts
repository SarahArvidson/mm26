import { SupabaseIntegration } from '@ffx/sdk/services';

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

export const supabase = new SupabaseIntegration({
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
});