const fetch = require('node-fetch');

async function test() {
    try {
        const date = new Date().toISOString().split('T')[0];
        const url = `http://localhost:3000/api/admin/attendance-summary?date=${date}`;
        console.log(`Fetching ${url}...`);
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log(`Data:`, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`Error:`, e.message);
    }
}

test();
