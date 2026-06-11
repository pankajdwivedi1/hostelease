const Razorpay = require('razorpay');
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testRazorpay() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.log("Missing Supabase credentials");
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('platform_settings')
            .select('settings')
            .eq('id', 'boss_payment_config')
            .single();

        if (error || !data) {
            console.log("Failed to fetch settings from DB:", error);
            return;
        }

        const settings = data.settings;
        console.log("Fetched Settings:", {
            enableRazorpay: settings.enableRazorpay,
            keyId: settings.razorpayKeyId ? "SET" : "MISSING",
            keySecret: settings.razorpayKeySecret ? "SET" : "MISSING"
        });

        if (!settings.razorpayKeyId || !settings.razorpayKeySecret) {
            console.log("Razorpay keys are missing in DB.");
            return;
        }

        const razorpay = new Razorpay({
            key_id: settings.razorpayKeyId,
            key_secret: settings.razorpayKeySecret
        });

        const options = {
            amount: 50000, // 500 INR
            currency: "INR",
            receipt: "test_receipt_123"
        };

        const order = await razorpay.orders.create(options);
        console.log("SUCCESS! Order created:", order.id);

    } catch (err) {
        console.error("RAZORPAY ERROR:", err);
    }
}

testRazorpay();
