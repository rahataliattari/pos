// Public configuration. These two values are safe to ship to the browser:
//  - the project URL
//  - the *publishable* (anon) key, which is limited by Row Level Security.
// NEVER put a service-role / sb_secret_ key here.
// For deployments, generate this file from environment variables, e.g.:
//   echo "window.POS_CONFIG={SUPABASE_URL:'$SUPABASE_URL',SUPABASE_KEY:'$SUPABASE_PUBLISHABLE_KEY'};" > config.js
window.POS_CONFIG = {
  SUPABASE_URL: 'https://coaqsescapfdgpnazcod.supabase.co',
  // Mobile numbers are converted to <number>@LOGIN_DOMAIN for Supabase password login (no SMS provider needed).
  LOGIN_DOMAIN: 'pos-login.app',
  // Web Push کی PUBLIC key (محفوظ ہے)۔ PRIVATE key کبھی یہاں نہ ڈالیں — صرف Supabase secrets میں۔
  VAPID_PUBLIC: 'BLpoeBWwSZQfSoikKc6r7MkBYz40CDEvQGYeQHp_MOjunQwNYdEPyUVGt6PpE9M9KXBI5KOrd5bW9Cgk8DqlumM',
  SUPABASE_KEY: 'sb_publishable_IbLlFB8IAYnrlwSOIocJbQ_wBhdYydr'
};
