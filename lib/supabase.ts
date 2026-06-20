
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');

    if (!supabaseUrl || !supabaseKey) {
        if (isBuildPhase) {
            console.warn('⚠️ Warning: Missing Supabase client variables during build phase. Returning dummy client.');
            return new Proxy({}, {
                get(target, prop) {
                    return () => {};
                }
            }) as any;
        }
        throw new Error('Missing Supabase client variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        }
    });
};

export const supabase = new Proxy({} as any, {
    get(target, prop) {
        const client = getSupabaseClient();
        return Reflect.get(client, prop);
    }
});

