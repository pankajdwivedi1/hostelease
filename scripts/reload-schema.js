const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Error: DATABASE_URL is not defined in .env.local");
  process.exit(1);
}

async function reloadSchema() {
  const client = new Client({ connectionString });
  
  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected successfully.");

    console.log("Sending NOTIFY pgrst, 'reload schema'...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("Schema reload signal sent successfully!");
  } catch (error) {
    console.error("Failed to reload schema cache:", error);
  } finally {
    await client.end();
  }
}

reloadSchema();
