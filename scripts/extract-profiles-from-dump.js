const fs = require('fs');

let raw = fs.readFileSync('out.json', 'utf16le');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const data = JSON.parse(raw);

const studentsMap = {};
for (const item of data) {
  if (item.students) {
    const s = item.students;
    const key = s.email || s.name || s._id;
    studentsMap[key] = s;
  }
}

console.log("Extracted unique students from out.json:", Object.keys(studentsMap).length);
console.log("Sample extracted student profile:", Object.values(studentsMap)[0]);
