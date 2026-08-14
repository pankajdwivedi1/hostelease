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

async function checkDatewiseAttendance() {
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await pgClient.connect();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const dates = [
        "01-08-2026", "02-08-2026", "03-08-2026", "04-08-2026", "05-08-2026",
        "06-08-2026", "07-08-2026", "08-08-2026", "09-08-2026", "10-08-2026",
        "11-08-2026", "12-08-2026", "13-08-2026", "14-08-2026"
    ];

    try {
        // 1. Fetch Railway date counts via SQL GROUP BY
        const rwRes = await pgClient.query(`
            SELECT COALESCE(NULLIF(ist_date, ''), date) AS date_key, COUNT(*) as cnt 
            FROM "attendance" 
            WHERE COALESCE(NULLIF(ist_date, ''), date) = ANY($1)
            GROUP BY date_key
        `, [dates]);

        const rwMap = new Map();
        rwRes.rows.forEach(r => {
            if (r.date_key) rwMap.set(r.date_key, parseInt(r.cnt, 10));
        });

        // 2. Fetch Supabase date counts in parallel
        const sbPromises = dates.map(async (dStr) => {
            const { count } = await supabase
                .from('attendance')
                .select('*', { count: 'exact', head: true })
                .or(`ist_date.eq.${dStr},date.eq.${dStr}`);
            return { date: dStr, count: count || 0 };
        });

        const sbResults = await Promise.all(sbPromises);
        const sbMap = new Map();
        sbResults.forEach(r => sbMap.set(r.date, r.count));

        const finalTable = dates.map(dStr => {
            const [dd, mm, yyyy] = dStr.split('-');
            const rwCount = rwMap.get(dStr) || 0;
            const sbCount = sbMap.get(dStr) || 0;
            return {
                date: `${dd}/${mm}/${yyyy}`,
                dStr,
                rwCount,
                sbCount,
                same: rwCount === sbCount
            };
        });

        console.log("MARKDOWN_OUTPUT_START");
        console.log("| Date | Railway Count | Supabase Count | Same / Identical? | Difference |");
        console.log("| :--- | :---: | :---: | :---: | :---: |");
        let totalRw = 0;
        let totalSb = 0;
        finalTable.forEach(row => {
            totalRw += row.rwCount;
            totalSb += row.sbCount;
            const diff = Math.abs(row.rwCount - row.sbCount);
            const sameTag = row.same ? '✅ Yes' : '❌ No';
            const diffText = diff === 0 ? '0' : `Diff: ${diff}`;
            console.log(`| ${row.date} | **${row.rwCount}** | **${row.sbCount}** | ${sameTag} | ${diffText} |`);
        });
        console.log(`| **TOTAL (01/08 - 14/08)** | **${totalRw}** | **${totalSb}** | ${totalRw === totalSb ? '✅ Yes' : '❌ No'} | **Diff: ${Math.abs(totalRw - totalSb)}** |`);
        console.log("MARKDOWN_OUTPUT_END");

    } catch (err) {
        console.error("Error executing query:", err);
    } finally {
        await pgClient.end();
    }
}

checkDatewiseAttendance();
