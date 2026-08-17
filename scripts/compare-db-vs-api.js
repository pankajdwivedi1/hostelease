require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const http = require('http');

async function apiGet(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data.slice(0, 300) }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1) Direct DB queries for each branch
  const branches = ['CS', 'AIML', 'DS', 'IT', 'ME'];
  console.log('=== DIRECT DB COUNT BY BRANCH ===');
  for (const b of branches) {
    const r = await client.query("SELECT COUNT(*) FROM students WHERE branch = $1", [b]);
    console.log(`  ${b}: ${r.rows[0].count}`);
  }

  const colleges = ['OIST', 'OCT', 'OCP', 'OPM'];
  console.log('\n=== DIRECT DB COUNT BY COLLEGE ===');
  for (const c of colleges) {
    const r = await client.query("SELECT COUNT(*) FROM students WHERE college_name = $1", [c]);
    console.log(`  ${c}: ${r.rows[0].count}`);
  }

  const semesters = ['1ST SEM', '2ND SEM', '3RD SEM', '4TH SEM', '5TH SEM', '6TH SEM', '7TH SEM', '8TH SEM'];
  console.log('\n=== DIRECT DB COUNT BY SEMESTER ===');
  for (const s of semesters) {
    const r = await client.query("SELECT COUNT(*) FROM students WHERE semester = $1", [s]);
    console.log(`  ${s}: ${r.rows[0].count}`);
  }

  const years = ['1ST YEAR', '2ND YEAR', '3RD YEAR', '4TH YEAR'];
  console.log('\n=== DIRECT DB COUNT BY YEAR ===');
  for (const y of years) {
    const r = await client.query("SELECT COUNT(*) FROM students WHERE year = $1", [y]);
    console.log(`  ${y}: ${r.rows[0].count}`);
  }

  const sections = ['A', 'B', 'C', 'D', 'E'];
  console.log('\n=== DIRECT DB COUNT BY SECTION ===');
  for (const sec of sections) {
    const r = await client.query("SELECT COUNT(*) FROM students WHERE section = $1", [sec]);
    console.log(`  ${sec}: ${r.rows[0].count}`);
  }

  // 2) Now test via API
  console.log('\n=== API FILTER COUNTS ===');
  const tests = [
    '/api/students?branch=AIML',
    '/api/students?branch=CS',
    '/api/students?branch=DS',
    '/api/students?branch=IT',
    '/api/students?collegeName=OIST',
    '/api/students?collegeName=OCT',
    '/api/students?semester=2ND+SEM',
    '/api/students?semester=1ST+SEM',
    '/api/students?section=A',
    '/api/students?section=B',
    '/api/students?limit=10',
  ];
  for (const t of tests) {
    const res = await apiGet(t);
    if (res.error) {
      console.log(`  ${t} => ERROR: ${res.error}`);
    } else {
      const arr = Array.isArray(res.body) ? res.body : (res.body?.students || res.body?.data || []);
      console.log(`  ${t} => status ${res.status}, count: ${Array.isArray(arr) ? arr.length : JSON.stringify(res.body).slice(0, 100)}`);
    }
  }

  await client.end();
}
run().catch(console.error);
