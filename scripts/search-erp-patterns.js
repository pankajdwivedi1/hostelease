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
      } else if (item.name.endsWith('.xlsx') || item.name.endsWith('.xls') || item.name.endsWith('.csv') || item.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  } catch (_) {}
  return files;
}

async function run() {
  console.log("=== SEARCHING DESKTOP FOR STOIST/STOCT/STOCP ERP PATTERNS ===");
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = dirs.flatMap(getAllFiles);
  console.log(`Found ${files.length} data/JSON files on Desktop.`);

  let matchCount = 0;
  for (const file of files) {
    if (file.includes('inspect-source-details') || file.includes('smart-match')) continue;
    try {
      if (file.endsWith('.json')) {
        // Read text and search
        const content = fs.readFileSync(file, 'utf-8');
        if (/STOIST|STOCT|STOCP/i.test(content)) {
          console.log(`\nMatch in JSON file: ${file}`);
          // Print sample line
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (/STOIST|STOCT|STOCP/i.test(lines[i])) {
              console.log(`Line ${i + 1}: ${lines[i].slice(0, 200)}`);
              matchCount++;
              if (matchCount > 5) break;
            }
          }
        }
      } else {
        const wb = XLSX.readFile(file);
        for (const sheetName of wb.SheetNames) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowStr = JSON.stringify(row);
            if (/STOIST|STOCT|STOCP/i.test(rowStr)) {
              console.log(`\nMatch in Excel file: ${path.basename(file)} | Sheet: ${sheetName} | Row: ${i + 1}`);
              console.log(row);
              matchCount++;
              if (matchCount > 5) break;
            }
          }
          if (matchCount > 5) break;
        }
      }
    } catch (e) {
      // ignore errors
    }
    if (matchCount > 5) break;
  }
  console.log(`\nTotal matches found: ${matchCount}`);
}
run();
