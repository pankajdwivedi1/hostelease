require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL Railway database...");

  // Load out.json
  console.log("Reading out.json...");
  let raw = fs.readFileSync('out.json', 'utf16le');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const dump = JSON.parse(raw);
  
  // Extract all unique student profile objects from the dump
  const profilesMap = new Map();
  for (const item of dump) {
    const s = item.students || item.student || item.studentId;
    if (s && s.email) {
      const emailKey = s.email.toLowerCase().trim();
      const existing = profilesMap.get(emailKey) || {};
      
      // Merge values prioritizing non-null
      const dob = s.dob || s.date_of_birth || existing.dob;
      const erp = s.erp_id || s.erp_information || s.erpId || existing.erp;
      const joiningDate = s.joining_date || s.joiningDate || existing.joiningDate;
      const fatherName = s.father_name || s.fatherName || existing.fatherName;
      const fatherNumber = s.father_number || s.fatherNumber || existing.fatherNumber;
      const motherName = s.mother_name || s.motherName || existing.motherName;
      const motherNumber = s.mother_number || s.motherNumber || existing.motherNumber;
      const permanentAddress = s.permanent_address || s.permanentAddress || existing.permanentAddress;
      const homeState = s.home_state || s.homeState || existing.homeState;

      profilesMap.set(emailKey, {
        dob,
        erp,
        joiningDate,
        fatherName,
        fatherNumber,
        motherName,
        motherNumber,
        permanentAddress,
        homeState
      });
    }
  }
  
  console.log(`Found ${profilesMap.size} unique student profiles in out.json.`);

  // Update in DB
  let updatedCount = 0;
  for (const [email, prof] of profilesMap.entries()) {
    // Look up student in DB
    const { rows } = await client.query("SELECT _id, name, dob, erp_information, joining_date FROM students WHERE LOWER(email) = $1", [email]);
    if (rows.length > 0) {
      const dbStudent = rows[0];
      
      // We only update if DB values are null but out.json has them
      const updateFields = [];
      const params = [];
      let paramIdx = 1;

      if (!dbStudent.dob && prof.dob) {
        updateFields.push(`dob = $${paramIdx++}`);
        params.push(new Date(prof.dob));
      }
      if (!dbStudent.erp_information && prof.erp) {
        updateFields.push(`erp_information = $${paramIdx++}`);
        params.push(prof.erp);
      }
      if (!dbStudent.joining_date && prof.joiningDate) {
        updateFields.push(`joining_date = $${paramIdx++}`);
        params.push(new Date(prof.joiningDate));
      }

      // Also merge parent details if missing in DB
      const dbFull = await client.query("SELECT father_name, father_number, mother_name, mother_number, permanent_address, home_state FROM students WHERE _id = $1", [dbStudent._id]);
      const sFull = dbFull.rows[0];
      if (sFull) {
        if (!sFull.father_name && prof.fatherName) {
          updateFields.push(`father_name = $${paramIdx++}`);
          params.push(prof.fatherName.toUpperCase());
        }
        if (!sFull.father_number && prof.fatherNumber) {
          updateFields.push(`father_number = $${paramIdx++}`);
          params.push(prof.fatherNumber);
        }
        if (!sFull.mother_name && prof.motherName) {
          updateFields.push(`mother_name = $${paramIdx++}`);
          params.push(prof.motherName.toUpperCase());
        }
        if (!sFull.mother_number && prof.motherNumber) {
          updateFields.push(`mother_number = $${paramIdx++}`);
          params.push(prof.motherNumber);
        }
        if (!sFull.permanent_address && prof.permanentAddress) {
          updateFields.push(`permanent_address = $${paramIdx++}`);
          params.push(prof.permanentAddress.toUpperCase());
        }
        if (!sFull.home_state && prof.homeState) {
          updateFields.push(`home_state = $${paramIdx++}`);
          params.push(prof.homeState.toUpperCase());
        }
      }

      if (updateFields.length > 0) {
        params.push(dbStudent._id);
        const query = `UPDATE students SET ${updateFields.join(', ')} WHERE _id = $${paramIdx}`;
        await client.query(query, params);
        updatedCount++;
      }
    }
  }

  console.log(`🎉 Successfully restored missing profile fields (DOB, ERP, Joining Date, Parents) for ${updatedCount} students in DB.`);

  // Double-verify PREMD
  const premdVerify = await client.query(
    "SELECT name, email, dob, erp_information, joining_date, father_name FROM students WHERE email = 'pankaj86.dwivedi@gmail.com'"
  );
  console.log("\n✅ PREMD VERIFIED IN DB:");
  console.table(premdVerify.rows);

  await client.end();
}

run().catch(console.error);
