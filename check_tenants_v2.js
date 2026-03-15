
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uifnnkzezqoavyatjmjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpZm5ua3plenFvYXZ5YXRqbWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQzMjIyMiwiZXhwIjoyMDg3MDA4MjIyfQ.zn7gxxVqpB6B7-igUTjFxMGngDYyi9QtAMvcWjKu76Q';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
    const { data, error } = await supabase.from('tenants').select('*');
    if (error) {
        console.error("Error fetching tenants:", error);
    } else {
        console.log("Tenants found:", JSON.stringify(data, null, 2));
    }
}

checkTenants();
