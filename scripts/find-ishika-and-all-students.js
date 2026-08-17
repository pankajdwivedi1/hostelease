const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

async function run() {
  console.log("=== SEARCHING FOR ISHIKA AGRAWAL (0105al231096@oriental.ac.in) ===");

  // 1. Check out.json
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);

  const dumpMatches = dump.filter(item => {
    const s = item.students || item.student;
    if (!s) return false;
    const str = JSON.stringify(s).toLowerCase();
    return str.includes("ishika") || str.includes("0105al231096");
  });

  console.log(`Found ${dumpMatches.length} matches in out.json.`);
  for (const m of dumpMatches) {
    console.log("out.json record:", m.students || m.student);
  }

  // 2. Check Desktop Files
  function getAllFiles(dir, files = []) {
    try {
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) getAllFiles(fullPath, files);
        else if (item.isFile() && (item.name.endsWith('.xlsx') || item.name.endsWith('.csv'))) files.push(fullPath);
      }
    } catch (_) {}
    return files;
  }

  const files = getAllFiles("c:\\Users\\PANKAJ DWIVEDI\\Desktop");
  for (const file of files) {
    try {
      const workbook = XLSX.readFile(file);
      for (const sheetName of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          const str = JSON.stringify(row).toLowerCase();
          if (str.includes("ishika") || str.includes("0105al231096")) {
            console.log(`Match in file "${path.basename(file)}" sheet "${sheetName}":`, row);
          }
        }
      }
    } catch (_) {}
  }
}

run().catch(console.error);
