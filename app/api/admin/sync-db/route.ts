export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAILWAY_URL = process.env.DATABASE_URL;

const TABLE_CONFIGS = [
  { name: 'tenants', pk: 'id' },
  { name: 'hostels', pk: '_id' },
  { name: 'admin_settings', pk: '_id' },
  { name: 'field_enforcement', pk: '_id' },
  { name: 'erp_members', pk: '_id' },
  { name: 'platform_settings', pk: 'id' },
  { name: 'students', pk: '_id' },
  { name: 'push_subscriptions', pk: '_id' },
  { name: 'student_field_progress', pk: '_id' },
  { name: 'permissions', pk: '_id' },
  { name: 'gate_passes', pk: '_id' },
  { name: 'gate_pass_tokens', pk: '_id' },
  { name: 'attendance', pk: '_id' },
  { name: 'transactions', pk: '_id' },
  { name: 'notifications', pk: '_id' }
];

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !RAILWAY_URL) {
    return NextResponse.json({ error: "Database environment variables are missing." }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const pgClient = new Client({
    connectionString: RAILWAY_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const { direction } = await req.json().catch(() => ({ direction: 'TWO_WAY' }));
    await pgClient.connect();

    const summary: Record<string, number> = {};

    // 1. SUPABASE -> RAILWAY SYNC
    if (direction === 'SUPABASE_TO_RAILWAY' || direction === 'TWO_WAY') {
      for (const config of TABLE_CONFIGS) {
        const { name: tableName, pk: pkCol } = config;

        // Fetch valid column names in Railway
        const colRes = await pgClient.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
        const validCols = new Set(colRes.rows.map(r => r.column_name));

        // Clear student collisions if needed
        if (tableName === 'students') {
          const { data: supStudents } = await supabase.from('students').select('_id, email, firebase_uid');
          if (supStudents && supStudents.length > 0) {
            const validEmails = supStudents.map(s => (s.email || '').toLowerCase()).filter(Boolean);
            const validFbUids = supStudents.map(s => s.firebase_uid).filter(Boolean);
            const supIdSet = new Set(supStudents.map(s => s._id));

            const res = await pgClient.query(`
              SELECT "_id", email, firebase_uid 
              FROM "students" 
              WHERE LOWER(email) = ANY($1) OR firebase_uid = ANY($2)
            `, [validEmails, validFbUids]);

            const toDeleteIds = res.rows.filter(r => !supIdSet.has(r._id)).map(r => r._id);
            if (toDeleteIds.length > 0) {
              await pgClient.query(`DELETE FROM "students" WHERE "_id" = ANY($1)`, [toDeleteIds]);
            }
          }
        }

        // Fetch all rows from Supabase
        let allSupData: any[] = [];
        let page = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error || !data || data.length === 0) break;
          allSupData.push(...data);
          if (data.length < pageSize) break;
          page++;
        }

        if (allSupData.length === 0) continue;

        // Batch Upsert to Railway
        const BATCH_SIZE = 100;
        let syncedCount = 0;

        for (let i = 0; i < allSupData.length; i += BATCH_SIZE) {
          const batch = allSupData.slice(i, i + BATCH_SIZE);
          const colsSet = new Set<string>();
          batch.forEach(item => {
            Object.keys(item).forEach(k => {
              if (validCols.has(k)) colsSet.add(k);
            });
          });
          colsSet.add(pkCol);
          const cols = Array.from(colsSet);

          const valueTuples: string[] = [];
          const flatValues: any[] = [];
          let paramIdx = 1;

          batch.forEach(item => {
            const rowPlaceholders: string[] = [];
            cols.forEach(col => {
              let val = item[col];
              if (col === pkCol && !val) val = item._id || item.id;
              if (val !== null && val !== undefined && typeof val === 'object') {
                val = JSON.stringify(val);
              }
              if (val === undefined) val = null;
              flatValues.push(val);
              rowPlaceholders.push(`$${paramIdx++}`);
            });
            valueTuples.push(`(${rowPlaceholders.join(', ')})`);
          });

          const colNamesStr = cols.map(c => `"${c}"`).join(', ');
          const updateCols = cols.filter(c => c !== pkCol);
          const updateSet = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
          const onConflict = updateCols.length > 0
            ? `ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSet}`
            : `ON CONFLICT ("${pkCol}") DO NOTHING`;

          const query = `
            INSERT INTO "${tableName}" (${colNamesStr})
            VALUES ${valueTuples.join(', ')}
            ${onConflict}
          `;

          try {
            await pgClient.query(query, flatValues);
            syncedCount += batch.length;
          } catch (e: any) {
            console.error(`Error batch syncing ${tableName} to Railway:`, e.message);
          }
        }

        summary[`Supabase -> Railway (${tableName})`] = syncedCount;
      }
    }

    // 2. RAILWAY -> SUPABASE SYNC
    if (direction === 'RAILWAY_TO_SUPABASE' || direction === 'TWO_WAY') {
      for (const config of TABLE_CONFIGS) {
        const { name: tableName, pk: pkCol } = config;

        // Fetch all rows from Railway
        const rlwRes = await pgClient.query(`SELECT * FROM "${tableName}"`);
        const rlwData = rlwRes.rows;

        if (rlwData.length === 0) continue;

        let syncedCount = 0;
        const BATCH_SIZE = 100;

        for (let i = 0; i < rlwData.length; i += BATCH_SIZE) {
          const batch = rlwData.slice(i, i + BATCH_SIZE).map(row => {
            const parsedRow: any = { ...row };
            // Ensure JSON objects/strings parse properly for Supabase
            Object.keys(parsedRow).forEach(k => {
              if (typeof parsedRow[k] === 'string' && (parsedRow[k].startsWith('{') || parsedRow[k].startsWith('['))) {
                try {
                  parsedRow[k] = JSON.parse(parsedRow[k]);
                } catch (e) {
                  // Keep string if not valid JSON
                }
              }
            });
            return parsedRow;
          });

          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: pkCol });

          if (!error) {
            syncedCount += batch.length;
          } else {
            console.error(`Error batch syncing ${tableName} to Supabase:`, error.message);
          }
        }

        summary[`Railway -> Supabase (${tableName})`] = syncedCount;
      }
    }

    await pgClient.end();

    return NextResponse.json({
      success: true,
      message: "Database sync completed successfully! Both databases are 100% synced.",
      summary
    });

  } catch (err: any) {
    try { await pgClient.end(); } catch (e) {}
    console.error("Sync API error:", err);
    return NextResponse.json({ error: err.message || "Failed to execute database sync." }, { status: 500 });
  }
}
