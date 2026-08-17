require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL Railway database...");

  // Load all students
  const { rows: students } = await client.query("SELECT _id, name, erp_information, college_name FROM students");
  console.log(`Loaded ${students.length} students to check...`);

  let updatedCount = 0;

  for (const s of students) {
    const erp = s.erp_information || "";
    
    // We only replace if the ERP ID is empty, null, or starts with our generic placeholder "ERP-"
    if (!erp || erp.startsWith("ERP-") || erp === "N/A" || erp === "—") {
      const college = (s.college_name || "OIST").toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      
      // Use the last 5 characters of the hex ID as a unique numeric representation
      // We parse the hex slice to a number, and pad to 5 digits
      const hexSlice = s._id.slice(-5);
      const uniqueNum = parseInt(hexSlice, 16).toString().slice(-5).padStart(5, '0');
      
      // Generate clean native ERP ID: ST + COLLEGE + 23 + unique digits
      const generatedErp = `ST${college}23${uniqueNum}`;

      // Update in DB
      await client.query(
        "UPDATE students SET erp_information = $1 WHERE _id = $2",
        [generatedErp, s._id]
      );
      updatedCount++;
    }
  }

  console.log(`\n🎉 Successfully converted ${updatedCount} generic placeholders to native ERP IDs!`);

  // Verify roommates in Room 302 / 217
  console.log("\n✅ VERIFIED ROOM 302 STUDENTS:");
  const r302 = await client.query(
    "SELECT name, college_name, erp_information, registration_id, room_number FROM students WHERE room_number = '302'"
  );
  console.table(r302.rows);

  console.log("\n✅ VERIFIED ROOM 217 STUDENTS:");
  const r217 = await client.query(
    "SELECT name, college_name, erp_information, registration_id, room_number FROM students WHERE room_number = '217'"
  );
  console.table(r217.rows);

  await client.end();
}

run().catch(console.error);
