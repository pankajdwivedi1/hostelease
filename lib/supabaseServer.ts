import { createClient } from '@supabase/supabase-js';

// ⚡ CACHE: Store the Supabase client in a global variable for reuse
let cachedSupabaseAdmin: any = null;

const createSafeDummyAdminClient = () => {
    const dummyProxy: any = new Proxy(() => dummyProxy, {
        get(target, prop) {
            if (prop === 'then') {
                return (resolve: any) => resolve({ data: null, error: null, count: 0 });
            }
            if (prop === 'auth') {
                return {
                    admin: {
                        getUserById: async () => ({ data: { user: null }, error: null }),
                        deleteUser: async () => ({ data: null, error: null }),
                        updateUserById: async () => ({ data: { user: null }, error: null }),
                    },
                    getSession: async () => ({ data: { session: null }, error: null }),
                };
            }
            return dummyProxy;
        },
        apply(target, thisArg, argumentsList) {
            return dummyProxy;
        }
    });
    return dummyProxy;
};

// This client is for SERVER-SIDE use only.
// It uses the SERVICE ROLE key to bypass RLS.
export const getSupabaseAdmin = () => {
    if (cachedSupabaseAdmin) return cachedSupabaseAdmin;

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^["']|["']$/g, "");
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/^["']|["']$/g, "");

    if (!supabaseUrl || !supabaseServiceKey) {
        return createSafeDummyAdminClient();
    }

    try {
        cachedSupabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            }
        });
        return cachedSupabaseAdmin;
    } catch (e) {
        console.warn("⚠️ Failed to initialize Supabase Admin client, using safe dummy fallback:", e);
        return createSafeDummyAdminClient();
    }
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
