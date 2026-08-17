require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  const res = await client.query("SELECT _id, name, email, phone_number, hostel_name, room_number, registration_id, dynamic_fields, erp_information FROM students");
  console.log(`Analyzing ${res.rows.length} total student records in DB...`);

  let updatedCount = 0;
  const colStats = { OIST: 0, OCT: 0, OCP: 0, OPM: 0, OIPR: 0 };
  const branchStats = { CS: 0, DS: 0, AIML: 0, IT: 0, EC: 0, EX: 0, ME: 0, CE: 0, MCA: 0, "B PHARMA": 0 };

  for (const s of res.rows) {
    const textStr = [
      s.email || "",
      s.registration_id || "",
      s.room_number || "",
      s.erp_information || "",
      JSON.stringify(s.dynamic_fields || {})
    ].join(" ").toUpperCase();

    // Determine College
    let college = "OIST";
    if (textStr.includes("0108") || textStr.includes("OCT")) college = "OCT";
    else if (textStr.includes("0107") || textStr.includes("OCP") || textStr.includes("PHARMA")) college = "OCP";
    else if (textStr.includes("0109") || textStr.includes("OPM")) college = "OPM";
    else if (textStr.includes("OIPR")) college = "OIPR";

    // Determine Branch
    let branch = "CS";
    if (textStr.includes("AIML") || textStr.includes("AI")) branch = "AIML";
    else if (textStr.includes("CD") || textStr.includes("DS") || textStr.includes("DATA SCIENCE") || textStr.includes("CSDS")) branch = "DS";
    else if (textStr.includes("IT")) branch = "IT";
    else if (textStr.includes("EC") || textStr.includes("ECE")) branch = "EC";
    else if (textStr.includes("EX") || textStr.includes("EEE")) branch = "EX";
    else if (textStr.includes("ME") || textStr.includes("MECH")) branch = "ME";
    else if (textStr.includes("CE") || textStr.includes("CIVIL")) branch = "CE";
    else if (textStr.includes("MCA")) branch = "MCA";
    else if (textStr.includes("PHARMA") || textStr.includes("PY")) branch = "B PHARMA";

    // Determine Year & Semester
    let year = "1ST YEAR";
    let sem = "2ND SEM";
    if (textStr.includes("23") || textStr.includes("3RD SEM") || textStr.includes("4TH SEM")) {
      year = "2ND YEAR"; sem = "4TH SEM";
    } else if (textStr.includes("22") || textStr.includes("5TH SEM") || textStr.includes("6TH SEM")) {
      year = "3RD YEAR"; sem = "6TH SEM";
    } else if (textStr.includes("21") || textStr.includes("7TH SEM") || textStr.includes("8TH SEM")) {
      year = "4TH YEAR"; sem = "8TH SEM";
    }

    colStats[college] = (colStats[college] || 0) + 1;
    branchStats[branch] = (branchStats[branch] || 0) + 1;

    const q = `UPDATE students SET college_name = $1, branch = $2, year = $3, semester = $4 WHERE _id = $5`;
    await client.query(q, [college, branch, year, sem, s._id]);
    updatedCount++;
  }

  console.log("\n📊 UPDATED COLLEGE DISTRIBUTION:");
  console.table(colStats);

  console.log("\n📊 UPDATED BRANCH DISTRIBUTION:");
  console.table(branchStats);

  console.log(`\n🎉 SUCCESSFULLY UPDATED REAL COLLEGES & BRANCHES FOR ALL ${updatedCount} STUDENTS!`);
  await client.end();
}

run().catch(console.error);
