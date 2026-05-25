const fetch = require('node-fetch'); // or native fetch in newer node

async function testHeaders() {
    const authKey = "519254ATbuLFy7MglO6a11a1dcP1";
    const widgetId = "36657770556f363937313038";
    const payload = { widgetId: widgetId, identifier: "919999999999" };

    // Test 1: No Origin
    console.log("Test 1: No Origin");
    let res1 = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'authkey': authKey },
        body: JSON.stringify(payload)
    });
    console.log(await res1.json());

    // Test 2: Spoof Origin as localhost
    console.log("Test 2: Origin localhost");
    let res2 = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'authkey': authKey, 'Origin': 'http://localhost:3000' },
        body: JSON.stringify(payload)
    });
    console.log(await res2.json());

    // Test 3: tokenAuth header instead of authkey
    console.log("Test 3: tokenAuth header");
    let res3 = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', {
        method: 'POST',
        headers: { 'accept': 'application/json', 'content-type': 'application/json', 'tokenAuth': authKey, 'Origin': 'http://localhost:3000' },
        body: JSON.stringify(payload)
    });
    console.log(await res3.json());
}

testHeaders();
