require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT _id, name, email, college_name, branch, year, semester, section FROM students WHERE email LIKE '%@oriental.ac.in%'");
  console.log(`Found ${res.rows.length} students with @oriental.ac.in email.`);

  const parseEmail = (email) => {
    const local = email.split('@')[0].toLowerCase();
    let college = "OIST";
    if (local.startsWith("0108")) college = "OCT";
    if (local.startsWith("0107")) college = "OCP";
    if (local.startsWith("0109")) college = "OPM";

    let branch = "CS";
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

    let year = "1ST YEAR";
    let semester = "2ND SEM";
    if (local.includes("24")) { year = "1ST YEAR"; semester = "2ND SEM"; }
    else if (local.includes("23")) { year = "2ND YEAR"; semester = "4TH SEM"; }
    else if (local.includes("22")) { year = "3RD YEAR"; semester = "6TH SEM"; }
    else if (local.includes("21")) { year = "4TH YEAR"; semester = "8TH SEM"; }

    return { college, branch, year, semester, section: "A" };
  };

  let updatedCount = 0;
  for (const row of res.rows) {
    const derived = parseEmail(row.email);
    const updateRes = await client.query(
      `UPDATE students SET
        college_name = COALESCE(NULLIF(college_name, ''), $1),
        branch = COALESCE(NULLIF(branch, ''), $2),
        year = COALESCE(NULLIF(year, ''), $3),
        semester = COALESCE(NULLIF(semester, ''), $4),
        section = COALESCE(NULLIF(section, ''), $5)
      WHERE _id = $6`,
      [derived.college, derived.branch, derived.year, derived.semester, derived.section, row._id]
    );
    if (updateRes.rowCount > 0) updatedCount += updateRes.rowCount;
  }

  console.log(`✅ Auto-derived and populated academic details for ${updatedCount} Oriental Institute students!`);
  await client.end();
}

run().catch(console.error);
