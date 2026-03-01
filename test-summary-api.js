
async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/attendance-summary', {
            method: 'GET',
        });
        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch error:', e);
    }
}

test();
