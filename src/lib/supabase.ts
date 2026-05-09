import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Vampire Chronicle] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY не заданы. ' +
    'Создай .env.local или задай переменные на Vercel.',
  );
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
