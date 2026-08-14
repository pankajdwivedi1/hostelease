process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const parts = trimmed.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
            if (key && !process.env[key]) {
                process.env[key] = val;
            }
        }
    });
}

const { Client } = require('pg');

async function fixAttendanceDateFormats() {
    console.log("Connecting to Railway PostgreSQL database...");
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await pgClient.connect();

    try {
        console.log("Starting attendance date format standardization...");

        // 1. Ensure ist_date column contains DD-MM-YYYY format
        const r1 = await pgClient.query(`
            UPDATE "attendance"
            SET "ist_date" = "date"
            WHERE ("ist_date" IS NULL OR "ist_date" = '') AND "date" LIKE '__-__-____';
        `);
        console.log(`Updated ${r1.rowCount} rows: copied DD-MM-YYYY to ist_date.`);

        // 2. Normalize date column to YYYY-MM-DD format
        const r2 = await pgClient.query(`
            UPDATE "attendance"
            SET "date" = CONCAT(SUBSTRING("date" FROM 7 FOR 4), '-', SUBSTRING("date" FROM 4 FOR 2), '-', SUBSTRING("date" FROM 1 FOR 2))
            WHERE "date" LIKE '__-__-____';
        `);
        console.log(`Standardized ${r2.rowCount} attendance rows to YYYY-MM-DD format in "date" column.`);

        // 3. Ensure ist_date is populated for YYYY-MM-DD rows
        const r3 = await pgClient.query(`
            UPDATE "attendance"
            SET "ist_date" = CONCAT(SUBSTRING("date" FROM 9 FOR 2), '-', SUBSTRING("date" FROM 6 FOR 2), '-', SUBSTRING("date" FROM 1 FOR 4))
            WHERE ("ist_date" IS NULL OR "ist_date" = '') AND "date" LIKE '____-__-__';
        `);
        console.log(`Updated ${r3.rowCount} rows: derived ist_date from YYYY-MM-DD.`);

        console.log("\n==========================================================================");
        console.log("           VERIFYING STANDARDIZED ATTENDANCE DATE COUNTS                  ");
        console.log("==========================================================================");

        const checkRes = await pgClient.query(`
            SELECT 
                date, 
                ist_date, 
                COUNT(*) as count 
            FROM "attendance" 
            WHERE date >= '2026-08-01' AND date <= '2026-08-14'
            GROUP BY date, ist_date 
            ORDER BY date
        `);

        console.table(checkRes.rows);
        console.log("==========================================================================\n");
        console.log("✅ Attendance date standardization completed successfully!");

    } catch (err) {
        console.error("Error executing fix:", err);
    } finally {
        await pgClient.end();
    }
}

fixAttendanceDateFormats();
