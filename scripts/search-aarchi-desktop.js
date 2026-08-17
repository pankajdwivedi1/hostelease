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
  console.log("=== SEARCHING DESKTOP FILES FOR AARCHI SHARMA ===");
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = dirs.flatMap(getAllFiles);
  console.log(`Found ${files.length} Excel/CSV files on Desktop.`);

  let matchCount = 0;
  for (const file of files) {
    try {
      const wb = XLSX.readFile(file);
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowStr = JSON.stringify(row).toUpperCase();
          if (rowStr.includes("AARCHI")) {
            console.log(`\nMatch in file: ${path.basename(file)} | Sheet: ${sheetName} | Row: ${i + 1}`);
            console.log(row);
            matchCount++;
          }
        }
      }
    } catch (e) {
      // console.error(`Error reading ${file}:`, e.message);
    }
  }
  console.log(`\nTotal matches found in desktop files: ${matchCount}`);
}
run();
