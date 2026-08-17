const fs = require('fs');

async function run() {
  console.log("Reading out.json as utf16le...");
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const data = JSON.parse(raw);
  console.log("out.json parsed successfully!");
  if (Array.isArray(data)) {
    console.log("out.json is an Array of length:", data.length);
    console.log("Sample 1st item keys:", Object.keys(data[0]));
    console.log("Sample 1st item data:", data[0]);
  } else {
    console.log("Keys in out.json:", Object.keys(data));
  }
}

run().catch(console.error);
