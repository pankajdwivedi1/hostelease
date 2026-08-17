const { Client } = require("pg");

const hosts = [
  { host: "db.uifnnkzezqoavyatjmjh.supabase.co", port: 5432, user: "postgres" },
  { host: "aws-0-us-east-1.pooler.supabase.com", port: 6543, user: "postgres.uifnnkzezqoavyatjmjh" },
  { host: "aws-0-ap-south-1.pooler.supabase.com", port: 6543, user: "postgres.uifnnkzezqoavyatjmjh" },
  { host: "aws-0-eu-central-1.pooler.supabase.com", port: 6543, user: "postgres.uifnnkzezqoavyatjmjh" }
];

const passwords = [
  "Dwivedip@81",
  "Dwivedi@82",
  "Dwivedi@81",
  "Dwivedip@82",
  "Pankaj@82",
  "Pankajdwivedi81",
  "pankajdwivedi81",
  "PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl"
];

async function findWorkingConnection() {
  console.log("Searching for working Supabase connection...");
  for (const h of hosts) {
    for (const pw of passwords) {
      const client = new Client({
        host: h.host,
        port: h.port,
        user: h.user,
        password: pw,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });
      try {
        await client.connect();
        console.log(`\n🎉 FOUND WORKING SUPABASE CONNECTION!`);
        console.log(`Host: ${h.host}`);
        console.log(`Port: ${h.port}`);
        console.log(`User: ${h.user}`);
        console.log(`Password: ${pw}`);
        const connectionString = `postgresql://${h.user}:${encodeURIComponent(pw)}@${h.host}:${h.port}/postgres`;
        console.log(`ConnectionString: ${connectionString}`);
        await client.end();
        return connectionString;
      } catch (err) {
        console.log(`Failed ${h.host}:${h.port} user:${h.user} pw:${pw} -> ${err.message}`);
        try { await client.end(); } catch (_) {}
      }
    }
  }
  console.log("\n❌ Could not find a working Supabase password automatically.");
  return null;
}

findWorkingConnection();
