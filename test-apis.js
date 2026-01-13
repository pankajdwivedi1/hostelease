/**
 * Quick API Health Check Script
 * Tests all hostelease API endpoints
 */

const BASE_URL = 'http://localhost:3000';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

async function testAPI(name, method, endpoint, body = null, expectedStatus = 200) {
    try {
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const data = await response.json();

        const status = response.status === expectedStatus ? '✅' : '❌';
        const color = response.status === expectedStatus ? colors.green : colors.red;

        console.log(`${color}${status} ${name}${colors.reset}`);
        console.log(`   Status: ${response.status} | Expected: ${expectedStatus}`);

        if (response.status !== expectedStatus) {
            console.log(`   ${colors.red}Response:${colors.reset}`, JSON.stringify(data, null, 2));
        }

        return { success: response.status === expectedStatus, data, status: response.status };
    } catch (error) {
        console.log(`${colors.red}❌ ${name}${colors.reset}`);
        console.log(`   ${colors.red}Error: ${error.message}${colors.reset}`);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}🧪 HOSTELEASE API HEALTH CHECK${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    let passed = 0;
    let failed = 0;

    // 1. Test Authentication APIs
    console.log(`${colors.blue}🔐 Authentication APIs${colors.reset}\n`);

    const adminAuth = await testAPI(
        'Admin Authentication (Valid)',
        'POST',
        '/api/admin/auth',
        { password: 'pankajdwivedi81' }
    );
    adminAuth.success ? passed++ : failed++;

    const adminAuthFail = await testAPI(
        'Admin Authentication (Invalid)',
        'POST',
        '/api/admin/auth',
        { password: 'wrong' },
        401
    );
    adminAuthFail.success ? passed++ : failed++;

    const wardenAuth = await testAPI(
        'Warden Authentication (Valid)',
        'POST',
        '/api/warden/auth',
        { password: 'warden456' }
    );
    wardenAuth.success ? passed++ : failed++;

    const devAuth = await testAPI(
        'Developer Authentication (Valid)',
        'POST',
        '/api/developer/auth',
        { password: 'pankaj852' }
    );
    devAuth.success ? passed++ : failed++;

    // 2. Test Settings API
    console.log(`\n${colors.blue}⚙️  Admin Settings API${colors.reset}\n`);

    const settings = await testAPI(
        'Get Admin Settings',
        'GET',
        '/api/admin/settings'
    );
    settings.success ? passed++ : failed++;

    // 3. Test Hostels API
    console.log(`\n${colors.blue}🏨 Hostel Management API${colors.reset}\n`);

    const hostels = await testAPI(
        'Get All Hostels',
        'GET',
        '/api/hostels'
    );
    hostels.success ? passed++ : failed++;

    // 4. Test Students API
    console.log(`\n${colors.blue}👨‍🎓 Student Management APIs${colors.reset}\n`);

    const students = await testAPI(
        'Get All Students',
        'GET',
        '/api/students'
    );
    students.success ? passed++ : failed++;

    // 5. Test Permissions API
    console.log(`\n${colors.blue}📝 Permission Management API${colors.reset}\n`);

    const permissions = await testAPI(
        'Get All Permissions',
        'GET',
        '/api/permissions'
    );
    permissions.success ? passed++ : failed++;

    // Summary
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}📊 TEST SUMMARY${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    const total = passed + failed;
    const passRate = ((passed / total) * 100).toFixed(1);

    console.log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
    console.log(`${colors.yellow}📈 Success Rate: ${passRate}%${colors.reset}\n`);

    if (failed === 0) {
        console.log(`${colors.green}🎉 All APIs are working perfectly!${colors.reset}\n`);
    } else {
        console.log(`${colors.yellow}⚠️  Some APIs need attention. Check the errors above.${colors.reset}\n`);
    }

    // Additional Information
    console.log(`${colors.cyan}ℹ️  Additional Information:${colors.reset}`);
    if (settings.success && settings.data?.settings) {
        console.log(`   Hostel Location: ${settings.data.settings.hostelLocation?.lat}, ${settings.data.settings.hostelLocation?.lng}`);
        console.log(`   Check-in Radius: ${settings.data.settings.radius || 200} meters`);
    }
    if (hostels.success && hostels.data?.hostels) {
        console.log(`   Total Hostels: ${hostels.data.hostels.length}`);
    }
    if (students.success && students.data?.students) {
        console.log(`   Total Students: ${students.data.students.length}`);
    }
    if (permissions.success && permissions.data?.permissions) {
        console.log(`   Total Permissions: ${permissions.data.permissions.length}`);
    }
    console.log();
}

// Run the tests
runTests().catch(console.error);
