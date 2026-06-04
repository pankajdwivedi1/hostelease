const fetch = require('node-fetch'); // Use native fetch if Node 18+, else we can just use native fetch directly since it's Node 18+

async function testVoice() {
  const authKey = "519254ATbuLFy7MglO6a11a1dcP1";
  const campaignId = "2652"; // This is actually the Flow/Template ID
  const phone = "919993452481";

  console.log("Testing MSG91 Flow API...");

  try {
    const response = await fetch("https://control.msg91.com/api/v5/voice/call/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authkey": authKey,
      },
      body: JSON.stringify({
        template: campaignId,
        client_number: phone,
        variables: {
          var1: { type: "text", value: "Test Hostel" },
          var2: { type: "text", value: "Test Student" },
          var3: { type: "text", value: "2026-06-04" },
          var4: { type: "text", value: "2026-06-05" },
          var5: { type: "text", value: "leave-12345" }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HTTP Error:", response.status, errorText);
      return;
    }

    const data = await response.json();
    console.log("Success Response:", data);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

testVoice();
