const testAPIs = async () => {
    const baseURL = 'http://localhost:3000';

    console.log('Testing Admin APIs...\n');

    // Test 1: Students
    try {
        console.log('1. Testing /api/students?light=true');
        const studentsRes = await fetch(`${baseURL}/api/students?light=true`);
        const studentsData = await studentsRes.json();
        console.log('Status:', studentsRes.status);
        if (studentsRes.ok) {
            console.log('✅ Students fetched:', studentsData.students?.length || 0);
        } else {
            console.log('❌ Error:', studentsData.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }

    console.log('\n');

    // Test 2: Hostels
    try {
        console.log('2. Testing /api/admin/hostels');
        const hostelsRes = await fetch(`${baseURL}/api/admin/hostels`);
        const hostelsData = await hostelsRes.json();
        console.log('Status:', hostelsRes.status);
        if (hostelsRes.ok) {
            console.log('✅ Hostels fetched:', hostelsData.hostels?.length || 0);
        } else {
            console.log('❌ Error:', hostelsData.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }

    console.log('\n');

    // Test 3: Permissions
    try {
        console.log('3. Testing /api/permissions?light=true');
        const permissionsRes = await fetch(`${baseURL}/api/permissions?light=true`);
        const permissionsData = await permissionsRes.json();
        console.log('Status:', permissionsRes.status);
        if (permissionsRes.ok) {
            console.log('✅ Permissions fetched:', permissionsData.permissions?.length || 0);
        } else {
            console.log('❌ Error:', permissionsData.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
};

testAPIs();
