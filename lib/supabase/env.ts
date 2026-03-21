export const supabaseEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  authEnforced: process.env.NEXT_PUBLIC_AUTH_ENFORCED !== 'false',
};

export function hasSupabaseCredentials() {
  return Boolean(supabaseEnv.url && supabaseEnv.anonKey);
}

export function isSupabaseAuthEnabled() {
  return hasSupabaseCredentials() && supabaseEnv.authEnforced;
}
