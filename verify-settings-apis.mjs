import fetch from 'node-fetch';

const testSettingsAPIs = async () => {
    const baseURL = 'http://localhost:3000';
    const tenantSlug = 'oist'; // Hardcoding oist as we've been working with it

    console.log('--- Testing Settings & Configuration APIs ---\n');

    // 1. Test /api/tenant/config (Public branding)
    try {
        console.log('1. Fetching Public Tenant Config...');
        // We simulate a request from a tenant by passing a header or query param if the middleware supports it
        // Our middleware supports x-tenant-slug header or tenant query param
        const res = await fetch(`${baseURL}/api/tenant/config?tenant=${tenantSlug}`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (data.success) {
            console.log('✅ Public Config:', {
                name: data.name,
                logo: data.logo,
                primaryColor: data.primaryColor
            });
        } else {
            console.log('❌ Error:', data.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
    console.log('\n');

    // 2. Test /api/admin/settings (Global settings)
    try {
        console.log('2. Fetching Admin Settings...');
        const res = await fetch(`${baseURL}/api/admin/settings?tenant=${tenantSlug}`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (data.success) {
            console.log('✅ Admin Settings Fetched');
            console.log('   Locations Count:', data.locations?.length || 0);
            console.log('   Attendance Window:', `${data.startTime} - ${data.endTime}`);
            console.log('   Passwords Check:', {
                warden: '***',
                admin: '***',
                developer: '***'
            });
        } else {
            console.log('❌ Error:', data.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
    console.log('\n');

    // 3. Test /api/admin/tenant (Admin tenant branding)
    try {
        console.log('3. Fetching Admin Tenant Brand Config...');
        const res = await fetch(`${baseURL}/api/admin/tenant?tenant=${tenantSlug}`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (data.success) {
            console.log('✅ Admin Tenant Brand Info:', data.tenant);
        } else {
            console.log('❌ Error:', data.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
    console.log('\n');
    // 4. Test /api/admin/field-enforcement
    try {
        console.log('4. Fetching Field Enforcement Rules...');
        const res = await fetch(`${baseURL}/api/admin/field-enforcement?tenant=${tenantSlug}`);
        const data = await res.json();
        console.log('Status:', res.status);
        if (data.success) {
            console.log('✅ Field Enforcement rules fetched:', data.data?.length || 0);
        } else {
            console.log('❌ Error:', data.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
    console.log('\n');

    console.log('--- Verification Complete ---');
};

testSettingsAPIs();
