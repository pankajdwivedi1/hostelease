require("dotenv").config({ path: ".env.local" });

const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !key) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in .env.local");
  process.exit(1);
}

async function runMigration() {
  const headers = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  };

  // 1. Add notification_settings column to admin_settings table
  const addColumnQuery = `
    ALTER TABLE admin_settings 
    ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;
  `;
  
  // 2. Create push_subscriptions table
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      user_type VARCHAR(50) NOT NULL,
      subscription JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 3. Reload PostgREST schema cache
  const reloadSchemaQuery = "NOTIFY pgrst, 'reload schema';";

  try {
    console.log("1. Adding notification_settings column to admin_settings on Supabase...");
    let res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: addColumnQuery })
    });
    console.log("Response status:", res.status, await res.text());

    console.log("2. Creating push_subscriptions table on Supabase...");
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: createTableQuery })
    });
    console.log("Response status:", res.status, await res.text());

    console.log("3. Reloading PostgREST schema cache on Supabase...");
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: reloadSchemaQuery })
    });
    console.log("Response status:", res.status, await res.text());

    console.log("Supabase migration completed successfully!");
  } catch (error) {
    console.error("Supabase migration failed:", error);
  }
}

runMigration();
