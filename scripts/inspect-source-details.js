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

// Simple Levenshtein distance for fuzzy name matching
function getEditDistance(a, b) {
  if (a.length === 0) return b.length; 
  if (b.length === 0) return a.length; 
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
      }
    }
  }
  return matrix[b.length][a.length];
}

function nameSimilarity(name1, name2) {
  const n1 = name1.toUpperCase().replace(/[^A-Z]/g, '');
  const n2 = name2.toUpperCase().replace(/[^A-Z]/g, '');
  if (n1 === n2) return 1.0;
  const dist = getEditDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  return 1.0 - (dist / maxLen);
}

async function run() {
  console.log("=== ANALYZING ALL DATA SOURCES FOR PARENT/ADDRESS INFO ===");

  // 1. Extract from out.json
  let outData = [];
  try {
    let raw = fs.readFileSync('out.json', 'utf16le');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const dump = JSON.parse(raw);
    for (const item of dump) {
      const s = item.students || item.student || item.studentId;
      if (s && s.name && (s.father_name || s.fatherName || s.permanent_address || s.permanentAddress)) {
        outData.push({
          name: s.name.toUpperCase().trim(),
          email: s.email ? s.email.toLowerCase().trim() : "",
          phone: s.phone_number || s.phoneNumber || "",
          father: s.father_name || s.fatherName || "",
          mother: s.mother_name || s.motherName || "",
          fatherPhone: s.father_number || s.fatherNumber || "",
          motherPhone: s.mother_number || s.motherNumber || "",
          address: s.permanent_address || s.permanentAddress || "",
          state: s.home_state || s.homeState || "",
          guardian: s.local_guardian_address || s.localGuardianAddress || "",
          guardianPhone: s.local_guardian_phone_number || s.localGuardianPhoneNumber || ""
        });
      }
    }
    console.log(`Extracted ${outData.length} records with parent/address details from out.json.`);
  } catch (e) {
    console.error("Error reading out.json:", e.message);
  }

  // 2. Extract from Desktop Excel/CSV files
  const dirs = [
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\Oriental college_Data",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop\\Desktop icon12-07-2025\\New folder",
    "c:\\Users\\PANKAJ DWIVEDI\\Desktop"
  ];
  const files = getAllFiles(dirs[0]).concat(getAllFiles(dirs[1])).concat(getAllFiles(dirs[2]));
  console.log(`Scanning ${files.length} Excel/CSV files...`);
  
  let excelData = [];
  for (const file of files) {
    try {
      const wb = XLSX.readFile(file);
      for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
        for (const row of rows) {
          let name = "", email = "", phone = "", father = "", mother = "", fatherPhone = "", address = "", state = "";
          for (const [k, v] of Object.entries(row)) {
            const vs = String(v).trim();
            const kl = k.toLowerCase().replace(/\s/g, '');
            if ((kl === 'fullname' || kl === 'name' || kl === 'studentname') && !name) name = vs;
            if ((kl.includes('email') || kl.includes('emailid')) && !email) email = vs.toLowerCase();
            if ((kl.includes('mobilenumber') || kl.includes('contactno') || (kl.includes('mobile') && !kl.includes('parent') && !kl.includes('father') && !kl.includes('mother'))) && !phone) phone = vs;
            if ((kl.includes('fatherfullname') || kl === 'fathername' || kl === "father'sname") && !father) father = vs;
            if ((kl.includes('mothername') || kl === "mother'sname") && !mother) mother = vs;
            if ((kl.includes('parentmobilenumber') || kl.includes('fatherphone') || kl.includes('fathermobile') || kl.includes('parentmobile')) && !fatherPhone) fatherPhone = vs;
            if ((kl.includes('address') || kl.includes('permanentaddress')) && !address) address = vs;
            if ((kl.includes('state') || kl.includes('homestate')) && !state) state = vs;
          }

          if (name && (father || mother || address || state)) {
            excelData.push({
              name: name.toUpperCase().trim(),
              email: email,
              phone: phone,
              father: father,
              mother: mother,
              fatherPhone: fatherPhone,
              address: address,
              state: state
            });
          }
        }
      }
    } catch (_) {}
  }
  console.log(`Extracted ${excelData.length} records with parent/address details from Excel/CSV files.`);

  // Combine both sources
  const allSources = [...outData, ...excelData];
  console.log(`Total source records available for mapping: ${allSources.length}`);

  // Print first 5 source records
  console.log("\nSample Source Records:");
  console.table(allSources.slice(0, 5));
}
run();
