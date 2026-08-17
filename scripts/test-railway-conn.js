const { Client } = require('pg');

const targetUrl = "postgresql://postgres:PiUUSLCdzQvIPfhQEggBwSrNwOzTdVl@thomas.proxy.rlwy.net:25119/railway";

async function testRailway() {
    console.log("Testing connection to Railway PostgreSQL...");
    const client = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        console.log("✅ Successfully connected to Railway PostgreSQL!");
        const res = await client.query("SELECT current_database(), current_user, version();");
        console.log("Database info:", res.rows[0]);
        await client.end();
    } catch (err) {
        console.error("❌ Railway connection failed:", err.message);
    }
}

testRailway();
