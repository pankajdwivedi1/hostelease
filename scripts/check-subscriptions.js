const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSub() {
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*");
    
    if (error) {
      console.error("DB Error:", error);
    } else {
      console.log("Subscriptions currently in Supabase:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

checkSub();
