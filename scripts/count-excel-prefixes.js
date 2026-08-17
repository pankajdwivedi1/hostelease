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
  console.log("=== COUNTING ERP PREFIXES IN ALL EXCEL SOURCE FILES ===");
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = dirs.flatMap(getAllFiles);
  
  const erpCounts = {};
  const processedErps = new Set();

  for (const file of files) {
    if (file.includes('inspect') || file.includes('smart-match') || file.includes('search-erp') || file.includes('count-')) continue;
    try {
      const wb = XLSX.readFile(file);
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          // Look for any ERP ID inside row properties
          for (const [k, v] of Object.entries(row)) {
            const vs = String(v).trim().toUpperCase();
            if (/^ST(OIST|OCT|OCP)/.test(vs)) {
              if (!processedErps.has(vs)) {
                processedErps.add(vs);
                const match = vs.match(/^ST(OIST|OCT|OCP)/);
                if (match) {
                  const prefix = match[1];
                  erpCounts[prefix] = (erpCounts[prefix] || 0) + 1;
                }
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  console.log(`\nProcessed ${processedErps.size} unique ERP IDs across all source files.`);
  console.log("College distribution found in Excel sheets:");
  console.table(erpCounts);
}
run();
