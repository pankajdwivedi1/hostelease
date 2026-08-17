const fs = require('fs');
const path = require('path');

function searchFiles(dir, exts, found = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !entry.name.startsWith('node_modules')) {
          searchFiles(fullPath, exts, found);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.includes(ext)) {
          found.push(fullPath);
        }
      }
    }
  } catch (_) {}
  return found;
}

console.log("Searching for Excel (.xlsx) and CSV (.csv) files in project and Desktop...");
const projectFiles = searchFiles('c:\\Users\\PANKAJ DWIVEDI\\Desktop\\hostelease', ['.xlsx', '.csv', '.json']);
const desktopFiles = searchFiles('c:\\Users\\PANKAJ DWIVEDI\\Desktop', ['.xlsx', '.csv']);

console.log("\n📁 Project Files:");
projectFiles.forEach(f => console.log("  ", f));

console.log("\n📁 Desktop Files:");
desktopFiles.forEach(f => console.log("  ", f));
