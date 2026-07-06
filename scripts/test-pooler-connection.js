const { Client } = require("pg");

const host = "aws-0-us-east-1.pooler.supabase.com";
const user = "postgres.uifnnkzezqoavyatjmjh";
const passwords = [
  "PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl",
  "pankajdwivedi81",
  "hostel258",
  "pankaj852"
];

async function tryPooler() {
  for (const password of passwords) {
    console.log(`Trying password: ${password.slice(0, 4)}...`);
    const client = new Client({
      host,
      port: 6543,
      user,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      console.log(`✅ Success! Connected using password: ${password}`);
      
      // Run migrations
      console.log("Creating push_subscriptions table and column...");
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
  console.log("None of the passwords worked on ap-south-1 pooler.");
}

tryPooler();
