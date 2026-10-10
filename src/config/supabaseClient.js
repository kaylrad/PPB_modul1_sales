import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ApiError } from '../utils/errors.js';

dotenv.config({ quiet: true });
let client;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    const missing = [];
    if (!url) missing.push('SUPABASE_URL belum diisi.');
    if (!key) missing.push('Isi SUPABASE_SERVICE_ROLE_KEY atau SUPABASE_KEY.');
    throw new ApiError(503, 'Konfigurasi Supabase belum tersedia.', missing);
  }
  try {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) },
    });
    return client;
  } catch {
    throw new ApiError(503, 'Konfigurasi Supabase tidak valid.');
  }
}
