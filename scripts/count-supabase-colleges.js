const fs = require('fs');

async function run() {
  console.log("=== COUNTING STUDENTS BY COLLEGE IN ORIGINAL SUPABASE DUMP (out.json) ===");
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);

    const collegeCounts = {};
    const processedStudentIds = new Set();

    for (const item of dump) {
      const s = item.students || item.student || item.studentId;
      if (s && s._id) {
        // Since out.json lists logs/attendance records, the same student ID might appear multiple times.
        // We use a Set to ensure we count each student exactly once.
        if (!processedStudentIds.has(s._id)) {
          processedStudentIds.add(s._id);
          
          let collegeName = s.college_name || s.collegeName || "Unassigned";
          collegeName = collegeName.toUpperCase().trim();
          
          collegeCounts[collegeName] = (collegeCounts[collegeName] || 0) + 1;
        }
      }
    }

    console.log(`\nTotal unique students found in out.json: ${processedStudentIds.size}`);
    console.log("\nDistribution by College in original Supabase:");
    console.table(collegeCounts);

  } catch (e) {
    console.error("Error reading/parsing out.json:", e.message);
  }
}
run();
