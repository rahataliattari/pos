// Public configuration. These two values are safe to ship to the browser:
//  - the project URL
//  - the *publishable* (anon) key, which is limited by Row Level Security.
// NEVER put a service-role / sb_secret_ key here.
// For deployments, generate this file from environment variables, e.g.:
//   echo "window.POS_CONFIG={SUPABASE_URL:'$SUPABASE_URL',SUPABASE_KEY:'$SUPABASE_PUBLISHABLE_KEY'};" > config.js
window.POS_CONFIG = {
  SUPABASE_URL: 'https://coaqsescapfdgpnazcod.supabase.co',
  SUPABASE_KEY: 'sb_publishable_IbLlFB8IAYnrlwSOIocJbQ_wBhdYydr'
};
