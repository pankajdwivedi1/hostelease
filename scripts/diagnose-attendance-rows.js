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

async function diagnoseRows() {
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await pgClient.connect();

    try {
        console.log("==========================================================================");
        console.log("   DIAGNOSING RAILWAY ATTENDANCE TABLE BY TENANT & DATE FORMAT           ");
        console.log("==========================================================================");

        // 1. Group by tenant_id
        const tenantRes = await pgClient.query(`
            SELECT tenant_id, COUNT(*) as cnt 
            FROM "attendance" 
            GROUP BY tenant_id
        `);
        console.log("\n1. Attendance count grouped by tenant_id:");
        console.table(tenantRes.rows);

        // 2. Group by date and ist_date fields for the active tenant (26739d24-0214-409b-aa81-42e628e88c2b)
        const dateRes = await pgClient.query(`
            SELECT 
                tenant_id,
                date, 
                ist_date, 
                COUNT(*) as count 
            FROM "attendance" 
            GROUP BY tenant_id, date, ist_date 
            ORDER BY date, ist_date
        `);
        console.log("\n2. Attendance count grouped by date & ist_date fields:");
        console.table(dateRes.rows);

        // 3. Sample rows from attendance table
        const sampleRes = await pgClient.query(`
            SELECT id, tenant_id, student_id, date, ist_date, timestamp, created_at
            FROM "attendance"
            ORDER BY created_at DESC
            LIMIT 20
        `);
        console.log("\n3. Latest 20 attendance records in Railway:");
        console.table(sampleRes.rows);

    } catch (err) {
        console.error("Error running diagnosis:", err);
    } finally {
        await pgClient.end();
    }
}

diagnoseRows();
