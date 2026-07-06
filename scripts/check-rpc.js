const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRPC() {
  try {
    console.log("Calling exec_sql RPC...");
    const { data, error } = await supabase.rpc("exec_sql", {
      query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
    });
    
    if (error) {
      console.error("RPC Error:", error);
    } else {
      console.log("Tables list:", data);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

testRPC();
