const fs = require('fs');

function loadDump() {
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  return JSON.parse(raw);
}

const data = loadDump();
console.log("Total records in out.json:", data.length);
console.log("Sample 3 records:");
for (let i = 0; i < 3; i++) {
  console.log(`\n--- Record ${i + 1} (${data[i].name}) ---`);
  console.log("firebase_uid:", data[i].firebase_uid);
  console.log("phone_number:", data[i].phone_number);
  console.log("father_name:", data[i].father_name);
  console.log("father_number:", data[i].father_number);
  console.log("mother_name:", data[i].mother_name);
  console.log("mother_number:", data[i].mother_number);
  console.log("registration_id:", data[i].registration_id);
  console.log("college_name:", data[i].college_name);
  console.log("branch:", data[i].branch);
}
