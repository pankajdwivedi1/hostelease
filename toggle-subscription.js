const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function toggleSubscription() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.error("Missing Supabase credentials in .env.local");
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch the first active tenant to test
        const { data: tenant, error: fetchErr } = await supabase
            .from('tenants')
            .select('id, name, slug, subscription_status, subscription_end_date')
            .limit(1)
            .single();

        if (fetchErr || !tenant) {
            console.error("No tenant found:", fetchErr);
            return;
        }

        const now = new Date();
        const isCurrentlyExpired = tenant.subscription_status === 'expired' || 
            (tenant.subscription_end_date && new Date(tenant.subscription_end_date) < now);

        let nextStatus, nextEndDate;
        if (isCurrentlyExpired) {
            // Restore/Activate for 1 year
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            nextStatus = 'active';
            nextEndDate = nextYear.toISOString();
        } else {
            // Expire subscription (set end date to yesterday)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            nextStatus = 'expired';
            nextEndDate = yesterday.toISOString();
        }

        // 2. Update status in the database
        const { error: updateErr } = await supabase
            .from('tenants')
            .update({
                subscription_status: nextStatus,
                subscription_end_date: nextEndDate
            })
            .eq('id', tenant.id);

        if (updateErr) {
            console.error("Failed to update tenant status:", updateErr);
            return;
        }

        console.log(`\n========================================`);
        console.log(`Successfully toggled subscription for:`);
        console.log(`College Name : ${tenant.name}`);
        console.log(`Tenant Slug  : ${tenant.slug}`);
        console.log(`----------------------------------------`);
        console.log(`New Status   : ${nextStatus.toUpperCase()}`);
        console.log(`New End Date : ${nextEndDate}`);
        console.log(`========================================\n`);

    } catch (err) {
        console.error("Error toggling subscription:", err);
    }
}

toggleSubscription();
