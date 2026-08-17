require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to PostgreSQL DB...");

  const res = await client.query("SELECT _id, email, name, college_name, branch, year, semester, section FROM students");
  console.log(`Checking ${res.rows.length} students in DB...`);

  let updatedCount = 0;

  for (const s of res.rows) {
    const email = (s.email || "").toLowerCase();
    const local = email.split('@')[0] || "";

    let college = s.college_name;
    if (!college) {
      if (local.startsWith("0108")) college = "OCT";
      else if (local.startsWith("0107")) college = "OCP";
      else if (local.startsWith("0109")) college = "OPM";
      else college = "OIST";
    }

    let branch = s.branch;
    if (!branch) {
      if (local.includes("cs")) branch = "CS";
      else if (local.includes("cd") || local.includes("ds")) branch = "DS";
      else if (local.includes("aiml") || local.includes("ai")) branch = "AIML";
      else if (local.includes("me")) branch = "ME";
      else if (local.includes("ce")) branch = "CE";
      else if (local.includes("ec")) branch = "EC";
      else if (local.includes("it")) branch = "IT";
      else if (local.includes("ex")) branch = "EX";
      else if (local.includes("mca")) branch = "MCA";
      else if (local.includes("bpharma") || local.includes("py")) branch = "B PHARMA";
      else branch = "CS";
    }

    let year = s.year;
    let semester = s.semester;
    if (!year) {
      if (local.includes("24")) { year = "1ST YEAR"; semester = semester || "2ND SEM"; }
      else if (local.includes("23")) { year = "2ND YEAR"; semester = semester || "4TH SEM"; }
      else if (local.includes("22")) { year = "3RD YEAR"; semester = semester || "6TH SEM"; }
      else if (local.includes("21")) { year = "4TH YEAR"; semester = semester || "8TH SEM"; }
      else { year = "1ST YEAR"; semester = semester || "2ND SEM"; }
    }
    if (!semester) semester = "2ND SEM";

    let section = s.section || "A";

    const updateRes = await client.query(
      `UPDATE students SET
        college_name = COALESCE(NULLIF(college_name, ''), $1),
        branch = COALESCE(NULLIF(branch, ''), $2),
        year = COALESCE(NULLIF(year, ''), $3),
        semester = COALESCE(NULLIF(semester, ''), $4),
        section = COALESCE(NULLIF(section, ''), $5)
      WHERE _id = $6`,
      [college, branch, year, semester, section, s._id]
    );

    if (updateRes.rowCount > 0) updatedCount += updateRes.rowCount;
  }

  console.log(`🎉 POPULATED ACADEMIC INFO FOR ALL ${updatedCount} STUDENTS IN POSTGRESQL DB!`);
  await client.end();
}

run().catch(console.error);
