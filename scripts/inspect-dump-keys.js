const fs = require('fs');

let raw = fs.readFileSync('out.json', 'utf16le');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const data = JSON.parse(raw);

console.log("data length:", data.length);
console.log("data[0] keys:", Object.keys(data[0]));
console.log("data[0] content:", JSON.stringify(data[0], null, 2).substring(0, 1000));
