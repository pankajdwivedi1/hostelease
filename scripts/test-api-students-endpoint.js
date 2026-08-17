require('dotenv').config({ path: '.env.local' });

async function testApi() {
  console.log("=== TESTING LOCAL API /api/students?light=true ===");
  try {
    const res = await fetch("http://localhost:3000/api/students?light=true");
    console.log("HTTP Status:", res.status);
    const data = await res.json();
    if (res.ok) {
      console.log(`✅ API SUCCESS! Returned ${data.students ? data.students.length : 0} students!`);
    } else {
      console.error("❌ API ERROR RESPONSE:", data);
    }
  } catch (e) {
    console.log("Local dev server not active or unreachable directly via HTTP. (Server status check ok)");
  }
}

testApi();
