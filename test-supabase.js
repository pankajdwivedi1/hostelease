
const { createClient } = require('@supabase/supabase-js');

async function test() {
    console.log("Testing Supabase connection with timeout (No dotenv)...");
    const url = 'https://uifnnkzezqoavyatjmjh.supabase.co';
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZm5ua3plenFvYXZ5YXRqbWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMjIyMiwiZXhwIjoyMDg3MDA4MjIyfQ.zn7gxxVqpB6B7-igUTjFxMGngDYyi9QtAMvcWjKu76Q';

    const supabase = createClient(url, key, {
        global: {
            fetch: (...args) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 sec timeout
                return fetch(args[0], { ...args[1], signal: controller.signal })
                    .then(res => {
                        console.log('Fetch response received status:', res.status);
                        return res;
                    })
                    .finally(() => clearTimeout(timeoutId));
            }
        }
    });

    try {
        console.log("Fetching tenants...");
        const { data, error } = await supabase.from('tenants').select('id').limit(1);
        if (error) {
            console.error("Supabase Error:", error);
        } else {
            console.log("Success! Found:", data);
        }
    } catch (e) {
        console.error("Exception Name:", e.name);
        console.error("Exception Message:", e.message);
    }
}

test();
