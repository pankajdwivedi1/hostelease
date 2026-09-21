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

export const getSupabaseClient = () => {
    return createSafeDummyClient();
};

export const supabase = createSafeDummyClient();
