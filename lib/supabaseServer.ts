import { createClient } from '@supabase/supabase-js';

// ⚡ CACHE: Store the Supabase client in a global variable for reuse
let cachedSupabaseAdmin: any = null;

// This client is for SERVER-SIDE use only.
// It uses the SERVICE ROLE key to bypass RLS.
export const getSupabaseAdmin = () => {
    if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase Server-Side Environment Variables');
    }

    cachedSupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    });

    return cachedSupabaseAdmin;
};
