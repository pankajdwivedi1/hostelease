const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

async function runMigration() {
  const client = new Client({ connectionString });
  
  try {
    console.log("Connecting to PostgreSQL database...");
    await client.connect();
    console.log("Connected successfully.");

    // 1. Add notification_settings column to admin_settings table if it doesn't exist
    console.log("Checking and adding notification_settings column to admin_settings...");
    await client.query(`
      ALTER TABLE admin_settings 
      ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;
    `);
    console.log("Column notification_settings is ready.");

    // 2. Create push_subscriptions table if it doesn't exist
    console.log("Checking and creating push_subscriptions table...");
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
    console.log("Table push_subscriptions is ready.");

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
