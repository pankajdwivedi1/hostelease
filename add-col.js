const url = 'https://uifnnkzezqoavyatjmjh.supabase.co/rest/v1/rpc/exec_sql';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZm5ua3plenFvYXZ5YXRqbWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMjIyMiwiZXhwIjoyMDg3MDA4MjIyfQ.zn7gxxVqpB6B7-igUTjFxMGngDYyi9QtAMvcWjKu76Q';

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'ALTER TABLE permissions ADD COLUMN parent_status TEXT DEFAULT \'pending\';' })
})
.then(async r => {
    console.log(r.status);
    console.log(await r.text());
})
.catch(console.error);
