import fetch from 'node-fetch';

const testBlockersAPI = async () => {
    const baseURL = 'http://localhost:3000';
    const studentId = 'c6ecb16a-498c-4f14-b55c-ae5e361d3bea';

    console.log(`--- Testing Blockers API for student: ${studentId} ---`);

    try {
        const response = await fetch(`${baseURL}/api/student/profile-blockers?studentId=${studentId}&tenant=oist`);
        const data = await response.json();
        
        console.log('Status:', response.status);
        console.log('Missing Fields:', JSON.stringify(data.missingFields, null, 2));
        console.log('Debug info:', JSON.stringify(data.debug, null, 2));
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
};

testBlockersAPI();
