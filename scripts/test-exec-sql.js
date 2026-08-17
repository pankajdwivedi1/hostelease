const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZm5ua3plenFvYXZ5YXRqbWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMjIyMiwiZXhwIjoyMDg3MDA4MjIyfQ.zn7gxxVqpB6B7-igUTjFxMGngDYyi9QtAMvcWjKu76Q';
const url = 'https://uifnnkzezqoavyatjmjh.supabase.co/rest/v1/rpc/exec_sql';

async function testRpc() {
    console.log("Testing exec_sql RPC on Supabase...");
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: 'SELECT COUNT(*) FROM students;' })
        });
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text);
    } catch (err) {
        console.error("RPC test failed:", err);
    }
}

testRpc();
