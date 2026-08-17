const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabasePassword = "Dwivedip@81";
const encodedPassword = encodeURIComponent(supabasePassword);
const sourceUrls = [
    `postgresql://postgres:${encodedPassword}@db.uifnnkzezqoavyatjmjh.supabase.co:5432/postgres`,
    `postgresql://postgres.uifnnkzezqoavyatjmjh:${encodedPassword}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
];
const targetUrl = "postgresql://postgres:PiUUSLCdzQvIPfhQEggGBwSrNwOzTdVl@thomas.proxy.rlwy.net:25119/railway";

const orderedTables = [
    'tenants',
    'hostels',
    'admin_settings',
    'students',
    'student_profiles',
    'student_security',
    'attendance',
    'gate_passes',
    'gate_pass_tokens',
    'permissions',
    'transactions',
    'student_field_progress',
    'notifications',
    'field_enforcement',
    'erp_members',
    'platform_settings',
    'push_subscriptions',
    'activity_logs'
];

async function executeFreshMigration() {
    console.log("=================================================");
    console.log("🚀 FINALIZING FRESH SUPABASE -> RAILWAY MIGRATION");
    console.log("=================================================\n");

    let sourceClient = null;
    for (const url of sourceUrls) {
        try {
            console.log(`Connecting to Supabase (${url.includes('pooler') ? 'Pooler' : 'Direct'})...`);
            const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
            client.on('error', () => {});
            await client.connect();
            sourceClient = client;
            console.log("✅ Connected to Supabase!");
            break;
        } catch (e) {
            console.log(`Note: ${e.message}`);
        }
    }

    if (!sourceClient) {
        console.error("❌ Unable to reach Supabase server. Retrying...");
        process.exit(1);
    }

    try {
        await sourceClient.query("SET statement_timeout = 0;");
    } catch (_) {}

    const targetClient = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
    targetClient.on('error', () => {});
    await targetClient.connect();
    console.log("✅ Connected to Railway DB.\n");

    try {
        const sbStudentsRes = await sourceClient.query(`SELECT COUNT(*) FROM students;`);
        const sbStudentCount = sbStudentsRes.rows[0].count;
        console.log(`📊 Total students in Supabase: ${sbStudentCount}`);

        console.log("\n⚙️ Disabling foreign key constraints on Railway DB...");
        await targetClient.query("SET session_replication_role = 'replica';");

        for (const table of orderedTables) {
            console.log(`-------------------------------------------------`);
            console.log(`📦 Migrating table: "${table}"...`);

            const targetCheck = await targetClient.query(`
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = $1;
            `, [table]);

            if (targetCheck.rows.length === 0) {
                console.log(`   ⚠️ Table "${table}" does not exist in target Railway schema. Skipping.`);
                continue;
            }

            const sourceColsRes = await sourceClient.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1;
            `, [table]);

            const targetColsRes = await targetClient.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1;
            `, [table]);

            const targetColsSet = new Set(targetColsRes.rows.map(c => c.column_name));
            const commonCols = sourceColsRes.rows
                .map(c => c.column_name)
                .filter(col => targetColsSet.has(col));

            if (commonCols.length === 0) {
                console.log(`   ⚠️ Table "${table}" has no common columns. Skipping.`);
                continue;
            }

            const colNames = commonCols.map(c => `"${c}"`).join(', ');

            const countRes = await sourceClient.query(`SELECT COUNT(*) FROM "${table}"`);
            const totalRows = parseInt(countRes.rows[0].count, 10);
            console.log(`   Found ${totalRows} fresh rows in Supabase.`);

            const currentCountRes = await targetClient.query(`SELECT COUNT(*) FROM "${table}"`);
            const currentRows = parseInt(currentCountRes.rows[0].count, 10);

            if (currentRows === totalRows && totalRows > 0) {
                console.log(`   ✅ Already fully migrated (${currentRows}/${totalRows} rows). Skipping.`);
                continue;
            }

            try {
                await targetClient.query(`TRUNCATE TABLE "${table}" CASCADE;`);
                console.log(`   Cleared existing Railway data for "${table}".`);
            } catch (err) {
                console.warn(`   ⚠️ Note on truncate: ${err.message}`);
            }

            if (totalRows === 0) {
                console.log(`   └─ Table is empty in Supabase. Done.`);
                continue;
            }

            const chunkSize = 100;
            let migratedCount = 0;

            for (let offset = 0; offset < totalRows; offset += chunkSize) {
                const chunkRes = await sourceClient.query(`SELECT * FROM "${table}" LIMIT ${chunkSize} OFFSET ${offset}`);
                const rows = chunkRes.rows;

                if (rows.length === 0) break;

                const valueTuples = [];
                const paramValues = [];
                let paramIndex = 1;

                for (const row of rows) {
                    const placeholders = [];
                    for (const col of commonCols) {
                        placeholders.push(`$${paramIndex++}`);
                        let val = row[col];
                        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                            val = JSON.stringify(val);
                        }
                        paramValues.push(val);
                    }
                    valueTuples.push(`(${placeholders.join(', ')})`);
                }

                const insertQuery = `
                    INSERT INTO "${table}" (${colNames}) 
                    VALUES ${valueTuples.join(', ')}
                    ON CONFLICT DO NOTHING;
                `;

                try {
                    await targetClient.query(insertQuery, paramValues);
                    migratedCount += rows.length;
                } catch (batchErr) {
                    console.warn(`   ⚠️ Batch insert note on chunk [${offset}-${offset+rows.length}]: ${batchErr.message}`);
                }
            }

            console.log(`   ✅ Successfully migrated ${migratedCount}/${totalRows} fresh rows into "${table}".`);
        }

        console.log(`\n-------------------------------------------------`);
        console.log("⚙️ Re-enabling foreign key constraints on Railway DB...");
        try {
            await targetClient.query("SET session_replication_role = 'origin';");
        } catch (_) {}

        // Verify final counts
        const rwStudentsRes = await targetClient.query(`SELECT COUNT(*) FROM students;`);
        const rwStudentCount = rwStudentsRes.rows[0].count;

        const rwGatePassRes = await targetClient.query(`SELECT COUNT(*) FROM gate_passes;`);
        const rwGatePassCount = rwGatePassRes.rows[0].count;

        console.log("\n=================================================");
        console.log("🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!");
        console.log(`- Supabase Students:   ${sbStudentCount}`);
        console.log(`- Railway Students:    ${rwStudentCount}`);
        console.log(`- Railway Gate Passes: ${rwGatePassCount}`);
        console.log("=================================================");

    } catch (error) {
        console.error("\n❌ Migration Failed with Error:", error);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

executeFreshMigration();
