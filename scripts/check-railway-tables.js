const { Client } = require('pg');

const targetUrl = "postgresql://postgres:PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl@thomas.proxy.rlwy.net:25119/railway";

async function checkRailway() {
    const client = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log("Checking tables and row counts in Railway Postgres...");

    const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    `);

    for (const row of tablesRes.rows) {
        const tableName = row.table_name;
        const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
        console.log(`- ${tableName}: ${countRes.rows[0].count} rows`);
    }

    await client.end();
}

checkRailway();
