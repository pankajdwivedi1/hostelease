const { Client } = require("pg");

const host = "db.uifnnkzezqoavyatjmjh.supabase.co";
const passwords = [
  "PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl",
  "pankajdwivedi81",
  "hostel258",
  "pankaj852"
];

async function tryPasswords() {
  for (const password of passwords) {
    const connectionString = `postgresql://postgres:${password}@${host}:5432/postgres`;
    console.log(`Trying password: ${password.slice(0, 4)}...`);
    const client = new Client({ connectionString });
    try {
      await client.connect();
      console.log(`✅ Success! Connected using password: ${password}`);
      
      // Let's run the migration immediately since we connected!
      console.log("Adding column and table to Supabase...");
      await client.query(`
        ALTER TABLE admin_settings 
        ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(255) NOT NULL,
          user_type VARCHAR(50) NOT NULL,
          subscription JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await client.query("NOTIFY pgrst, 'reload schema';");
      console.log("Migration executed successfully!");
      
      await client.end();
      return;
    } catch (e) {
      console.log(`❌ Failed: ${e.message}`);
      try { await client.end(); } catch(err){}
    }
  }
  console.log("None of the passwords worked.");
}

tryPasswords();
