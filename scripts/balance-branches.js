require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const crypto = require('crypto');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT _id, name, email, college_name, registration_id, room_number FROM students");
  console.log(`Balancing branches for ${res.rows.length} students...`);

  const oistOctBranches = ["CS", "CS", "DS", "AIML", "IT", "IT", "EC", "EX", "ME", "CE"];

  const valueRows = [];
  const params = [];
  let pIdx = 1;

  for (const s of res.rows) {
    const text = `${s.email} ${s.registration_id || ''} ${s.room_number || ''} ${s.name}`.toLowerCase();
    const college = s.college_name || "OIST";

    let branch = null;
    if (text.includes("csds") || text.includes("data science")) branch = "DS";
    else if (text.includes("aiml") || text.includes("ai/ml")) branch = "AIML";
    else if (text.includes("mca")) branch = "MCA";
    else if (text.includes("pharma") || text.includes("b.py") || text.includes("py")) branch = "B PHARMA";

    if (!branch) {
      if (college === "OCP" || college === "OIPR") {
        branch = "B PHARMA";
      } else if (college === "OPM") {
        branch = "MCA";
      } else {
        const hash = crypto.createHash('md5').update(s._id || s.email || s.name).digest('hex');
        const num = parseInt(hash.substring(0, 8), 16);
        branch = oistOctBranches[num % oistOctBranches.length];
      }
    }

    valueRows.push(`($${pIdx++}, $${pIdx++})`);
    params.push(s._id, branch);
  }

  const query = `
    UPDATE students AS s SET
      branch = v.branch
    FROM (VALUES ${valueRows.join(', ')}) AS v(id, branch)
    WHERE s._id = v.id;
  `;

  await client.query(query, params);
  console.log("🎉 BRANCH BALANCING COMPLETE!");

  const branchSummary = await client.query("SELECT branch, COUNT(*) FROM students GROUP BY branch ORDER BY COUNT(*) DESC");
  console.log("\n📊 BALANCED BRANCH DISTRIBUTION:");
  console.table(branchSummary.rows);

  await client.end();
}

run().catch(console.error);
