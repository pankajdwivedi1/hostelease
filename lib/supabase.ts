
import { createClient } from '@supabase/supabase-js';

const createSafeDummyClient = () => {
    const dummyFn: any = (...args: any[]) => dummyProxy;
    const dummyProxy: any = new Proxy(dummyFn, {
        get(target, prop) {
            if (prop === 'then') {
                return undefined;
            }
            if (prop === 'auth') {
                return {
                    getSession: async () => ({ data: { session: null }, error: null }),
                    getUser: async () => ({ data: { user: null }, error: null }),
                    signOut: async () => ({ error: null }),
                    setSession: async () => ({ data: { session: null }, error: null }),
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
                };
            }
            if (prop === 'channel') {
                return () => ({
                    on: () => ({
                        subscribe: () => ({ unsubscribe: () => {} })
                    }),
                    subscribe: () => ({ unsubscribe: () => {} }),
                    unsubscribe: () => {}
                });
            }
            if (prop === 'removeChannel') {
                return () => Promise.resolve();
            }
            if (prop === 'from') {
                return () => dummyProxy;
            }
            return dummyProxy;
        },
        apply(target, thisArg, argumentsList) {
            return Promise.resolve({ data: null, error: null, count: 0 });
        }
    });
    return dummyProxy;
};

const getSupabaseClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return createSafeDummyClient();
    }

    try {
        return createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
    } catch (e) {
        console.warn("⚠️ Failed to initialize Supabase client, using safe dummy fallback:", e);
        return createSafeDummyClient();
    }
};

export const supabase = new Proxy({} as any, {
    get(target, prop) {
        const client = getSupabaseClient();
        return Reflect.get(client, prop);
    }
});

