require('dotenv').config({ path: '.env.local' });
const http = require('http');

function get(path) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data.slice(0, 500) }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

async function main() {
  // Fetch light student list and inspect first 5 for collegeName field
  console.log('Fetching /api/students?light=true ...');
  const res = await get('/api/students?light=true');
  
  if (!res.students) {
    console.error('No students in response:', JSON.stringify(res).slice(0, 300));
    return;
  }

  console.log(`\nTotal returned: ${res.students.length} students`);
  console.log('\nFirst 5 students - key fields:');
  for (const s of res.students.slice(0, 5)) {
    console.log({
      name: s.name,
      collegeName: s.collegeName,
      branch: s.branch,
      semester: s.semester,
      section: s.section,
      year: s.year,
      registrationId: s.registrationId,
    });
  }

  // Count by collegeName in the returned data
  const collegeCounts = {};
  const branchCounts = {};
  for (const s of res.students) {
    collegeCounts[s.collegeName || 'NULL'] = (collegeCounts[s.collegeName || 'NULL'] || 0) + 1;
    branchCounts[s.branch || 'NULL'] = (branchCounts[s.branch || 'NULL'] || 0) + 1;
  }

  console.log('\nCOLLEGE COUNTS in API response:');
  console.table(Object.entries(collegeCounts).map(([k,v]) => ({ collegeName: k, count: v })));
  
  console.log('\nBRANCH COUNTS in API response:');
  console.table(Object.entries(branchCounts).map(([k,v]) => ({ branch: k, count: v })));

  // Check if any have null/undefined collegeName
  const nullCollege = res.students.filter(s => !s.collegeName);
  console.log(`\nStudents with NULL/undefined collegeName in API response: ${nullCollege.length}`);
  if (nullCollege.length > 0) {
    for (const s of nullCollege.slice(0, 3)) {
      console.log(' -', s.name, '| collegeName:', s.collegeName, '| all keys:', Object.keys(s).join(', '));
    }
  }
}

main().catch(console.error);
