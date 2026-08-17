const fs = require('fs');

async function run() {
  console.log("=== SEARCHING OUT.JSON FOR AARCHI SHARMA ===");
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);

    // Search by name
    const byName = dump.filter(item => {
      const s = item.students || item.student || item.studentId;
      return s && s.name && s.name.toUpperCase().includes("AARCHI");
    });
    console.log(`Found ${byName.length} matches by name 'AARCHI' in out.json:`);
    for (const item of byName) {
      const s = item.students || item.student || item.studentId;
      console.log(`  Name: ${s.name} | Email: ${s.email} | Phone: ${s.phone_number || s.phoneNumber}`);
    }

    // Search by email
    const byEmail = dump.filter(item => {
      const s = item.students || item.student || item.studentId;
      return s && s.email && s.email.toLowerCase().includes("aarchisharma320");
    });
    console.log(`\nFound ${byEmail.length} matches by email 'aarchisharma320' in out.json:`);
    for (const item of byEmail) {
      const s = item.students || item.student || item.studentId;
      console.log(`  Name: ${s.name} | Email: ${s.email}`);
    }

  } catch (e) {
    console.error("Error reading out.json:", e.message);
  }
}
run();
