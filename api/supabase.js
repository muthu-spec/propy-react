// Supabase Client Helper for Serverless Functions
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side use
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase client initialized:', { url: supabaseUrl, hasKey: !!supabaseKey });
