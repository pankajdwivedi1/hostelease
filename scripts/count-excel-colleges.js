const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function getAllFiles(dir) {
  const files = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else if (item.name.endsWith('.xlsx') || item.name.endsWith('.xls') || item.name.endsWith('.csv')) {
        files.push(fullPath);
      }
    }
  } catch (_) {}
  return files;
}

async function run() {
  console.log("=== SCANNING EXCEL FILES FOR COLLEGE NAME DISTRIBUTION ===");
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = dirs.flatMap(getAllFiles);
  console.log(`Found ${files.length} Excel/CSV files on Desktop.`);

  const collegeCounts = {};
  const studentColleges = new Map(); // Name -> College

  for (const file of files) {
    if (file.includes('inspect') || file.includes('smart-match') || file.includes('search-erp') || file.includes('count-')) continue;
    try {
      const wb = XLSX.readFile(file);
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          let name = "", college = "";
          for (const [k, v] of Object.entries(row)) {
            const vs = String(v).trim();
            const kl = k.toLowerCase().replace(/\s/g, '');
            if ((kl === 'fullname' || kl === 'name' || kl === 'studentname') && !name) name = vs.toUpperCase();
            if ((kl.includes('college') || kl === 'collegename' || kl.includes('inst') || kl.includes('org')) && !college) college = vs.toUpperCase();
          }

          if (name && college) {
            studentColleges.set(name, college);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  // Count distribution
  for (const col of studentColleges.values()) {
    collegeCounts[col] = (collegeCounts[col] || 0) + 1;
  }

  console.log(`\nFound ${studentColleges.size} unique students with college details in Excel sheets.`);
  console.log("\nDistribution in source Excel files:");
  console.table(collegeCounts);

  // Print 5 samples
  console.log("\nSample Student College Assignments from Excel:");
  const samples = Array.from(studentColleges.entries()).slice(0, 10);
  for (const [name, col] of samples) {
    console.log(`  ${name} -> ${col}`);
  }
}
run();
