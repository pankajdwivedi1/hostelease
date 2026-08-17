const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RAILWAY_URL = process.env.DATABASE_URL;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const pgClient = new Client({
  connectionString: RAILWAY_URL,
  ssl: { rejectUnauthorized: false }
});

async function diagnose() {
  await pgClient.connect();

  // Fetch Supabase students
  const { data: supStudents } = await supabase.from('students').select('_id, email, firebase_uid, tenant_id');
  console.log(`Supabase students: ${supStudents.length}`);

  // Fetch Railway students
  const res = await pgClient.query(`SELECT _id, email, firebase_uid, tenant_id FROM "students"`);
  console.log(`Railway students: ${res.rows.length}`);

  const supEmailMap = new Map();
  supStudents.forEach(s => supEmailMap.set(s.email.toLowerCase(), s._id));

  const rlwDuplicates = [];
  res.rows.forEach(r => {
    if (r.email) {
      const supId = supEmailMap.get(r.email.toLowerCase());
      if (supId && supId !== r._id) {
        rlwDuplicates.push({ email: r.email, rlwId: r._id, supId });
      }
    }
  });

  console.log(`Found ${rlwDuplicates.length} student email collisions with different IDs in Railway:`, rlwDuplicates);

  await pgClient.end();
}

diagnose();
