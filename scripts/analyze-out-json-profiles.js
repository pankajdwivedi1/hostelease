const fs = require('fs');

async function run() {
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);

  const studentMap = new Map();
  const collegeCounts = {};
  const branchCounts = {};

  for (const item of dump) {
    const s = item.students || item.student || item.studentId;
    if (!s || typeof s !== 'object') continue;

    const email = (s.email || "").toLowerCase().trim();
    const sId = s._id || s.id;
    const key = email || sId;
    if (!key) continue;

    if (!studentMap.has(key)) {
      studentMap.set(key, s);

      const col = s.college_name || s.collegeName || 'UNSPECIFIED';
      const br = s.branch || 'UNSPECIFIED';

      collegeCounts[col] = (collegeCounts[col] || 0) + 1;
      branchCounts[br] = (branchCounts[br] || 0) + 1;
    }
  }

  console.log(`TOTAL UNIQUE STUDENTS IN OUT.JSON: ${studentMap.size}`);
  console.log("\nCOLLEGE COUNTS IN DUMP:");
  console.table(collegeCounts);

  console.log("\nBRANCH COUNTS IN DUMP:");
  console.table(branchCounts);
}

run();
