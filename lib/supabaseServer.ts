import { createClient } from '@supabase/supabase-js';

// ⚡ CACHE: Store the Supabase client in a global variable for reuse
let cachedSupabaseAdmin: any = null;

// This client is for SERVER-SIDE use only.
// It uses the SERVICE ROLE key to bypass RLS.
export const getSupabaseAdmin = () => {
    if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^["']|["']$/g, "");
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/^["']|["']$/g, "");

    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE?.includes('build');

    if (!supabaseUrl || !supabaseServiceKey) {
        if (isBuildPhase) {
            console.warn('⚠️ Warning: Missing Supabase Server-Side Environment Variables during build phase. Returning dummy client.');
            return new Proxy({}, {
                get(target, prop) {
                    return () => {};
                }
            }) as any;
        }
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

export async function uploadProfilePictureToSupabase(base64Image: string, tenantId: string, studentId: string): Promise<string> {
    if (!base64Image) return "";
    
    // If it's already a full HTTP/HTTPS URL, preserve it
    if (base64Image.startsWith("http://") || base64Image.startsWith("https://")) {
        return base64Image;
    }

    // Expected format: data:image/jpeg;base64,... or raw base64
    if (base64Image.startsWith("data:image/")) {
        return base64Image;
    }

    // Wrap raw base64 with data URL prefix if needed
    return `data:image/jpeg;base64,${base64Image}`;
}
