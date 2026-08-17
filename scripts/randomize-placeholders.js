require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// Helper to generate a random date between two dates
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL Railway database...");

  // Load all students
  const { rows: students } = await client.query(
    "SELECT _id, name, dob, joining_date, mother_number, father_number, phone_number FROM students"
  );
  console.log(`Loaded ${students.length} students to check...`);

  let updatedCount = 0;

  for (const s of students) {
    const dob = s.dob ? new Date(s.dob).toISOString().split('T')[0] : "";
    const jDate = s.joining_date ? new Date(s.joining_date).toISOString().split('T')[0] : "";
    const mNum = s.mother_number || "";
    
    // We identify if the student is using the default fallback placeholders:
    // - DOB is exactly "2005-08-15" (15 August 2005)
    // - Joining Date is exactly "2025-10-01" (01 October 2025)
    // - Mother phone is null or empty
    const isDefaultDob = dob === "2005-08-15";
    const isDefaultJoining = jDate === "2025-10-01";
    const isDefaultMotherPhone = !mNum || mNum === "";

    if (isDefaultDob || isDefaultJoining || isDefaultMotherPhone) {
      const updates = [];
      const params = [];
      let pIdx = 1;

      // 1. Randomize DOB (birthdays between 2003 and 2006)
      if (isDefaultDob) {
        const rDob = randomDate(new Date("2003-01-01"), new Date("2006-12-31"));
        updates.push(`dob = $${pIdx++}`);
        params.push(rDob);
      }

      // 2. Randomize Joining Date (semester starts of 2024 and 2025)
      if (isDefaultJoining) {
        const year = Math.random() > 0.5 ? 2024 : 2025;
        const rJoining = randomDate(new Date(`${year}-07-15`), new Date(`${year}-10-15`));
        updates.push(`joining_date = $${pIdx++}`);
        params.push(rJoining);
      }

      // 3. Generate Mother's Mobile Number matching Father's pattern
      if (isDefaultMotherPhone) {
        const prefix = s.phone_number ? s.phone_number.replace(/\D/g, '').slice(0, 3) : "982";
        const suffix = Math.floor(Math.random() * 10000000).toString().padStart(7, '6');
        const mPhone = `${prefix}${suffix}`;
        updates.push(`mother_number = $${pIdx++}`);
        params.push(mPhone);
      }

      if (updates.length > 0) {
        params.push(s._id);
        const query = `UPDATE students SET ${updates.join(', ')} WHERE _id = $${pIdx}`;
        await client.query(query, params);
        updatedCount++;
      }
    }
  }

  console.log(`\n🎉 Successfully randomized placeholders and set unique profile details (DOB, Joining Date, Mother Mobile) for ${updatedCount} students!`);

  // Verify Aakansha Anand / Aarushi Anand / Aaradhna details now
  console.log("\n✅ VERIFIED TARGET STUDENT DETAILS:");
  const verified = await client.query(
    "SELECT name, dob, joining_date, father_name, father_number, mother_name, mother_number FROM students WHERE name LIKE '%AAKANSHA%' OR name LIKE '%AARADHNA%' OR name LIKE '%AARUSHI%'"
  );
  console.table(verified.rows);

  await client.end();
}

run().catch(console.error);
