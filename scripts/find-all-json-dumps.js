const fs = require('fs');
const path = require('path');

function searchDir(dir, found = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('node_modules') && !entry.name.startsWith('.next') && !entry.name.startsWith('.git')) {
          searchDir(fullPath, found);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.json') || entry.name.endsWith('.sql'))) {
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 10000) {
            found.push({ path: fullPath, size: stat.size });
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return found;
}

console.log("Searching for JSON / SQL dump files...");
const projectFiles = searchDir('c:\\Users\\PANKAJ DWIVEDI\\Desktop\\hostelease');
const geminiFiles = searchDir('C:\\Users\\PANKAJ DWIVEDI\\.gemini');

console.log("\n📁 Project JSON/SQL Files > 10KB:");
projectFiles.forEach(f => console.log(`  ${f.path} (${(f.size / 1024 / 1024).toFixed(2)} MB)`));

console.log("\n📁 Gemini JSON/SQL Files > 10KB:");
geminiFiles.forEach(f => console.log(`  ${f.path} (${(f.size / 1024 / 1024).toFixed(2)} MB)`));
