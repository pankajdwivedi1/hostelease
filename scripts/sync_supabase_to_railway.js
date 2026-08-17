const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAILWAY_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY || !RAILWAY_URL) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pgClient = new Client({
  connectionString: RAILWAY_URL,
  ssl: { rejectUnauthorized: false }
});

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

async function prepareStudentsTable() {
  console.log("Clearing email/firebase_uid collisions in Railway 'students' table...");
  const { data: supStudents } = await supabase.from('students').select('_id, email, firebase_uid');
  if (!supStudents || supStudents.length === 0) return;

  const validEmails = supStudents.map(s => (s.email || '').toLowerCase()).filter(Boolean);
  const validFbUids = supStudents.map(s => s.firebase_uid).filter(Boolean);
  const supIdSet = new Set(supStudents.map(s => s._id));

  const res = await pgClient.query(`
    SELECT "_id", email, firebase_uid 
    FROM "students" 
    WHERE LOWER(email) = ANY($1) OR firebase_uid = ANY($2)
  `, [validEmails, validFbUids]);

  const toDeleteIds = [];
  res.rows.forEach(r => {
    if (!supIdSet.has(r._id)) {
      toDeleteIds.push(r._id);
    }
  });

  if (toDeleteIds.length > 0) {
    console.log(`Deleting ${toDeleteIds.length} stale colliding student records in Railway...`);
    await pgClient.query(`DELETE FROM "students" WHERE "_id" = ANY($1)`, [toDeleteIds]);
  }
  console.log("Cleared student unique constraint collisions.");
}

async function syncTable(config, validColNames) {
  const { name: tableName, pk: pkCol } = config;
  console.log(`\n================ Syncing Table: ${tableName} ================`);

  if (tableName === 'students') {
    await prepareStudentsTable();
  }

  // 1. Fetch all records from Supabase
  let allSupData = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`❌ Error fetching ${tableName} from Supabase:`, error.message);
      return;
    }
    if (!data || data.length === 0) break;
    allSupData.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Fetched ${allSupData.length} records from Supabase for table '${tableName}'.`);

  if (allSupData.length === 0) {
    console.log(`No records to sync for table '${tableName}'.`);
    return;
  }

  // 2. Batch Upsert into Railway PostgreSQL
  const BATCH_SIZE = 100;
  let synced = 0;
  let errors = 0;

  for (let i = 0; i < allSupData.length; i += BATCH_SIZE) {
    const batch = allSupData.slice(i, i + BATCH_SIZE);
    
    // Determine common columns for batch
    const colsSet = new Set();
    batch.forEach(item => {
      Object.keys(item).forEach(k => {
        if (validColNames.has(k)) colsSet.add(k);
      });
    });
    colsSet.add(pkCol);
    const cols = Array.from(colsSet);

    const valueTuples = [];
    const flatValues = [];
    let paramIdx = 1;

    batch.forEach(item => {
      const rowPlaceholders = [];
      cols.forEach(col => {
        let val = item[col];
        if (col === pkCol && !val) {
          val = item._id || item.id;
        }
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
    let onConflictClause = '';
    if (updateCols.length > 0) {
      const updateSet = updateCols.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
      onConflictClause = `ON CONFLICT ("${pkCol}") DO UPDATE SET ${updateSet}`;
    } else {
      onConflictClause = `ON CONFLICT ("${pkCol}") DO NOTHING`;
    }

    const query = `
      INSERT INTO "${tableName}" (${colNamesStr})
      VALUES ${valueTuples.join(', ')}
      ${onConflictClause}
    `;

    try {
      await pgClient.query(query, flatValues);
      synced += batch.length;
    } catch (err) {
      // Fallback to row-by-row on batch failure
      for (const singleItem of batch) {
        try {
          const singleCols = Object.keys(singleItem).filter(k => validColNames.has(k));
          if (!singleCols.includes(pkCol)) singleCols.push(pkCol);

          const singleVals = singleCols.map(c => {
            let v = singleItem[c];
            if (c === pkCol && !v) v = singleItem._id || singleItem.id;
            if (v !== null && v !== undefined && typeof v === 'object') v = JSON.stringify(v);
            return v === undefined ? null : v;
          });

          const singleColNames = singleCols.map(c => `"${c}"`).join(', ');
          const singlePlaceholders = singleCols.map((_, idx) => `$${idx + 1}`).join(', ');
          const singleUpdates = singleCols.filter(c => c !== pkCol).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
          const singleOnConflict = singleUpdates ? `ON CONFLICT ("${pkCol}") DO UPDATE SET ${singleUpdates}` : `ON CONFLICT ("${pkCol}") DO NOTHING`;

          const singleQuery = `INSERT INTO "${tableName}" (${singleColNames}) VALUES (${singlePlaceholders}) ${singleOnConflict}`;
          await pgClient.query(singleQuery, singleVals);
          synced++;
        } catch (singleErr) {
          errors++;
          if (errors <= 5) {
            console.error(`❌ Upsert error on ${tableName} single row:`, singleErr.message);
          }
        }
      }
    }

    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= allSupData.length) {
      console.log(`Progress (${tableName}): ${Math.min(i + BATCH_SIZE, allSupData.length)} / ${allSupData.length} records synced.`);
    }
  }

  console.log(`✅ Synced ${synced} / ${allSupData.length} records into '${tableName}' (${errors} errors).`);
}

async function main() {
  console.log("Connecting to Railway PostgreSQL...");
  await pgClient.connect();
  console.log("Connected to Railway!");

  for (const config of TABLE_CONFIGS) {
    const res = await pgClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [config.name]);
    const validColNames = new Set(res.rows.map(r => r.column_name));

    await syncTable(config, validColNames);
  }

  console.log("\n================ ALL TABLES SYNC COMPLETED ================");
  await pgClient.end();
}

main().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
