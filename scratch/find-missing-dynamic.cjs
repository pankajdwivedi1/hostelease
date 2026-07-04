const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else {
            if (file === 'route.ts' || file === 'route.js') {
                files.push(name);
            }
        }
    }
    return files;
}

const apiDir = path.join(__dirname, '..', 'app', 'api');
const routes = getFiles(apiDir);

console.log(`🔍 Scanning ${routes.length} route files...`);

const missing = [];
for (const r of routes) {
    const content = fs.readFileSync(r, 'utf8');
    if (!content.includes('force-dynamic')) {
        missing.push(path.relative(path.join(__dirname, '..'), r));
    }
}

console.log("\n⚠️ Missing 'force-dynamic' routes:");
missing.forEach(m => console.log(`- ${m}`));
