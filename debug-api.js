// Native fetch used

async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/admin/attendance-summary');
        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
