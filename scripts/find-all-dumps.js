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
        if (exts.some(e => entry.name.toLowerCase().endsWith(e))) {
          found.push({ path: fullPath, size: entry.size || fs.statSync(fullPath).size });
        }
      }
    }
  } catch (_) {}
  return found;
}

console.log("Searching for SQL, JSON, CSV, DUMP files...");
const projectFiles = searchFiles('c:\\Users\\PANKAJ DWIVEDI\\Desktop\\hostelease', ['.sql', '.json', '.csv', '.dump', '.tar', '.gz', '.bak']);
const desktopFiles = searchFiles('c:\\Users\\PANKAJ DWIVEDI\\Desktop', ['.sql', '.csv', '.json', '.dump', '.bak']);

console.log("\n📁 Large Project Files:");
projectFiles.filter(f => f.size > 10000).forEach(f => console.log(`  ${(f.size / (1024*1024)).toFixed(2)} MB : ${f.path}`));

console.log("\n📁 Large Desktop Files:");
desktopFiles.filter(f => f.size > 10000).forEach(f => console.log(`  ${(f.size / (1024*1024)).toFixed(2)} MB : ${f.path}`));
