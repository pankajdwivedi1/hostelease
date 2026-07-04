import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We can read url and key from env or use the same project ref from the add-col.js script
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need the service role key or API key to authorize
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

// Convert url: e.g., https://uifnnkzezqoavyatjmjh.supabase.co -> https://uifnnkzezqoavyatjmjh.supabase.co/rest/v1/rpc/exec_sql
const rpcUrl = `${supabaseUrl}/rest/v1/rpc/exec_sql`;

console.log("Running migration query: ALTER TABLE permissions ADD COLUMN IF NOT EXISTS parent_consent_url TEXT;");

fetch(rpcUrl, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ query: 'ALTER TABLE permissions ADD COLUMN IF NOT EXISTS parent_consent_url TEXT;' })
})
.then(async r => {
    console.log("Status Code:", r.status);
    console.log("Response Text:", await r.text());
})
.catch(console.error);
