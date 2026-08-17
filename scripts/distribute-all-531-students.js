require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const crypto = require('crypto');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✅ Connected to Railway PostgreSQL DB!");

  const res = await client.query("SELECT _id, name, email, registration_id, room_number, hostel_name FROM students");
  console.log(`Processing all ${res.rows.length} students in DB...`);

  const colleges = ["OIST", "OIST", "OIST", "OCT", "OCT", "OCP", "OPM", "OIPR"];
  const branches = ["CS", "CS", "DS", "AIML", "IT", "EC", "EX", "ME", "CE", "MCA", "B PHARMA"];
  const years = ["1ST YEAR", "2ND YEAR", "3RD YEAR", "4TH YEAR"];
  const sems = ["1ST SEM", "2ND SEM", "3RD SEM", "4TH SEM", "5TH SEM", "6TH SEM", "7TH SEM", "8TH SEM"];
  const sections = ["A", "B", "C", "D"];

  let updatedCount = 0;

  for (const s of res.rows) {
    const text = `${s.email} ${s.registration_id || ''} ${s.room_number || ''} ${s.name}`.toLowerCase();

    // Check specific explicit patterns first
    let college = null;
    let branch = null;
    let year = null;
    let sem = null;
    let section = "A";

    if (text.includes("0108") || text.includes("oct")) college = "OCT";
    else if (text.includes("0107") || text.includes("ocp") || text.includes("pharma")) college = "OCP";
    else if (text.includes("0109") || text.includes("opm")) college = "OPM";
    else if (text.includes("oipr")) college = "OIPR";

    if (text.includes("aiml") || text.includes("ai")) branch = "AIML";
    else if (text.includes("cd") || text.includes("ds") || text.includes("csds")) branch = "DS";
    else if (text.includes("it")) branch = "IT";
    else if (text.includes("ec")) branch = "EC";
    else if (text.includes("ex")) branch = "EX";
    else if (text.includes("me")) branch = "ME";
    else if (text.includes("ce")) branch = "CE";
    else if (text.includes("mca")) branch = "MCA";
    else if (text.includes("pharma") || text.includes("py")) branch = "B PHARMA";

    // Hash fallback for uniform & realistic distribution across all 531 students
    const hash = crypto.createHash('md5').update(s._id || s.email || s.name).digest('hex');
    const num = parseInt(hash.substring(0, 8), 16);

    if (!college) college = colleges[num % colleges.length];
    if (!branch) {
      if (college === "OCP" || college === "OIPR") branch = "B PHARMA";
      else if (college === "OPM") branch = num % 2 === 0 ? "MCA" : "CS";
      else branch = branches[num % branches.length];
    }
    if (!year) year = years[num % years.length];
    if (!sem) {
      const yearIdx = years.indexOf(year);
      sem = sems[yearIdx * 2 + (num % 2)];
    }
    section = sections[num % sections.length];

    await client.query(
      `UPDATE students SET
        college_name = $1,
        branch = $2,
        year = $3,
        semester = $4,
        section = $5
      WHERE _id = $6`,
      [college, branch, year, sem, section, s._id]
    );

    updatedCount++;
  }

  console.log(`\n🎉 SUCCESSFULLY POPULATED REALISTIC CAMPUS DATA FOR ALL ${updatedCount} STUDENTS!`);

  const colSummary = await client.query("SELECT college_name, COUNT(*) FROM students GROUP BY college_name ORDER BY COUNT(*) DESC");
  console.log("\n📊 COLLEGE DISTRIBUTION:");
  console.table(colSummary.rows);

  const branchSummary = await client.query("SELECT branch, COUNT(*) FROM students GROUP BY branch ORDER BY COUNT(*) DESC");
  console.log("\n📊 BRANCH DISTRIBUTION:");
  console.table(branchSummary.rows);

  await client.end();
}

run().catch(console.error);
