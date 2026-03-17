import fetch from 'node-fetch';

const testStatusAPI = async () => {
    const baseURL = 'http://localhost:3000';
    const tenantSlug = 'oist'; 
    const hostel = 'Boys Hostel';

    console.log(`--- Testing Status API for ${hostel} ---`);

    try {
        const response = await fetch(`${baseURL}/api/admin/field-enforcement/status?hostelName=${encodeURIComponent(hostel)}&tenant=${tenantSlug}`);
        const data = await response.json();
        
        console.log('Status:', response.status);
        if (data.success) {
            console.log('✅ Stats:', JSON.stringify(data.data.completionStats, null, 2));
            console.log('Student Count:', data.data.studentsCompletionStatus.length);
        } else {
            console.log('❌ Error:', data.error);
        }
    } catch (e) {
        console.log('❌ Exception:', e.message);
    }
};

testStatusAPI();
