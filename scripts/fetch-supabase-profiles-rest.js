require('dotenv').config({ path: '.env.local' });

async function run() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/student_profiles?select=*&limit=10`;
  console.log("Fetching from Supabase REST API:", url);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    console.log("STATUS:", res.status);
    const data = await res.json();
    console.log("PROFILES FETCHED:", data.length);
    if (data.length > 0) {
      console.log("Sample profile:", data[0]);
    }
  } catch (err) {
    console.error("Fetch Error:", err.message);
  }
}

run();
