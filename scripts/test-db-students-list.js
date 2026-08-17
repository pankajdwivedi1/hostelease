require('dotenv').config({ path: '.env.local' });
const { db } = require('../lib/dbAdapter');

async function test() {
  console.log("=== TESTING db.students.list ({}, { light: true }) ===");
  try {
    const students = await db.students.list({}, { light: true });
    console.log(`✅ Success! Received ${students.length} students.`);
    if (students.length > 0) {
      console.log("Sample student:", {
        id: students[0]._id || students[0].id,
        name: students[0].name,
        hostelName: students[0].hostelName,
        roomNumber: students[0].roomNumber,
        tenantId: students[0].tenantId
      });
    }
  } catch (err) {
    console.error("❌ Exception in db.students.list:", err);
  }
}

test();
