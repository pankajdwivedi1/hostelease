const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function syncFinalTwo() {
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  function cleanDate(val) {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val;
  }
  function cleanJson(val) {
    if (!val) return null;
    if (typeof val === 'object') return JSON.stringify(val);
    return val;
  }
  function toUuid(val) {
    if (!val) return '00000000-0000-0000-0000-000000000000';
    const str = String(val).trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) return str;
    if (/^[0-9a-f]{24}$/i.test(str)) return `${str.slice(0,8)}-${str.slice(8,12)}-${str.slice(12,16)}-${str.slice(16,20)}-${str.slice(20,24)}00000008`;
    return '00000000-0000-0000-0000-000000000000';
  }

  // 1. push_subscriptions: Truncate and Insert all 230 rows
  const { data: sbPush } = await supabase.from('push_subscriptions').select('*');
  if (sbPush) {
    await pgClient.query('TRUNCATE TABLE push_subscriptions;');
    for (const r of sbPush) {
      await pgClient.query(`
        INSERT INTO push_subscriptions (_id, created_at, subscription, updated_at, user_id, user_type)
        VALUES ($1, $2, $3, $4, $5, $6);
      `, [toUuid(r._id), cleanDate(r.created_at), cleanJson(r.subscription) || '{}', cleanDate(r.updated_at), r.user_id || 'N/A', r.user_type || 'student']);
    }
  }

  // 2. admin_audit_logs: Sync all live rows
  let allLogs = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('admin_audit_logs').select('*').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allLogs = allLogs.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const logChunkSize = 200;
  for (let i = 0; i < allLogs.length; i += logChunkSize) {
    const chunk = allLogs.slice(i, i + logChunkSize);
    const valueTuples = [];
    const params = [];
    let pIdx = 1;

    for (const r of chunk) {
      params.push(
        r.id || r._id || `log-${pIdx}`, r.action || null, cleanDate(r.created_at), cleanJson(r.details),
        r.entity_id || null, r.entity_name || null, r.entity_type || null, r.performed_by || null, r.tenant_slug || null
      );
      const tuplePlaceholders = [];
      for (let k = 0; k < 9; k++) tuplePlaceholders.push(`$${pIdx++}`);
      valueTuples.push(`(${tuplePlaceholders.join(',')})`);
    }

    await pgClient.query(`
      INSERT INTO admin_audit_logs (id, action, created_at, details, entity_id, entity_name, entity_type, performed_by, tenant_slug)
      VALUES ${valueTuples.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        action = EXCLUDED.action, created_at = EXCLUDED.created_at, details = EXCLUDED.details,
        entity_id = EXCLUDED.entity_id, entity_name = EXCLUDED.entity_name, entity_type = EXCLUDED.entity_type,
        performed_by = EXCLUDED.performed_by, tenant_slug = EXCLUDED.tenant_slug;
    `, params);
  }

  console.log("✅ Final 2 tables synced!");
  await pgClient.end();
}

syncFinalTwo();
