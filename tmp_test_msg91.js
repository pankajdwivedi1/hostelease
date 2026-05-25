const authKey = "519254TAqxpB0E6a1428fdP1";
const widgetId = "36657770556f363937313038";
const phoneNumber = "919999999999"; // Dummy number

async function testSend() {
    const payload = {
        widgetId: widgetId,
        identifier: phoneNumber
    };

    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            authkey: authKey
        },
        body: JSON.stringify(payload)
    };

    const response = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', options);
    const data = await response.json();
    console.log(data);
}

testSend();
