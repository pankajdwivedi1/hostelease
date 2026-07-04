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

let fixedCount = 0;
for (const r of routes) {
    const content = fs.readFileSync(r, 'utf8');
    if (!content.includes('force-dynamic')) {
        const relativePath = path.relative(path.join(__dirname, '..'), r);
        console.log(`⚡ Adding force-dynamic to: ${relativePath}`);
        
        // Prepend force-dynamic config
        const updatedContent = `export const dynamic = "force-dynamic";\n\n` + content;
        fs.writeFileSync(r, updatedContent, 'utf8');
        fixedCount++;
    }
}

console.log(`\n✅ Finished fixing missing dynamic routes! Added to ${fixedCount} files.`);
