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
const { createClient } = require('@supabase/supabase-js');

async function checkCounts() {
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await pgClient.connect();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // 1. Railway Counts
        const rwGpRes = await pgClient.query('SELECT COUNT(*) FROM "gate_passes"');
        const railwayGatePasses = parseInt(rwGpRes.rows[0].count, 10);

        const rwAttRes = await pgClient.query('SELECT COUNT(*) FROM "attendance"');
        const railwayAttendances = parseInt(rwAttRes.rows[0].count, 10);

        // 2. Supabase Counts
        const { count: sbGpCount, error: gpErr } = await supabase
            .from('gate_passes')
            .select('*', { count: 'exact', head: true });

        let sbAttCount = null;
        let { count: c1 } = await supabase.from('attendance').select('*', { count: 'exact', head: true });
        if (c1 !== null) sbAttCount = c1;
        else {
            let { count: c2 } = await supabase.from('attendances').select('*', { count: 'exact', head: true });
            sbAttCount = c2;
        }

        console.log("==================================================");
        console.log("         EXACT DATABASE COUNTS REPORT            ");
        console.log("==================================================");
        console.log(`RAILWAY (PostgreSQL):`);
        console.log(`  • Gate Passes        : ${railwayGatePasses}`);
        console.log(`  • Attendance Logs    : ${railwayAttendances}`);
        console.log(`\nSUPABASE:`);
        console.log(`  • Gate Passes        : ${sbGpCount}`);
        console.log(`  • Attendance Logs    : ${sbAttCount}`);
        
        console.log("\n--------------------------------------------------");
        console.log("               COMPARISON SUMMARY                 ");
        console.log("--------------------------------------------------");
        console.log(`Gate Passes Identical?   : ${railwayGatePasses === sbGpCount ? 'YES (SAME)' : `NO (DIFFERENT - Diff: ${Math.abs(railwayGatePasses - sbGpCount)})`}`);
        console.log(`Attendance Logs Identical?: ${railwayAttendances === sbAttCount ? 'YES (SAME)' : `NO (DIFFERENT - Diff: ${Math.abs(railwayAttendances - (sbAttCount || 0))})`}`);
        console.log("==================================================\n");

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        await pgClient.end();
    }
}

checkCounts();
