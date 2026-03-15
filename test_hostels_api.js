
async function testHostels() {
    try {
        const response = await fetch('http://jaypee-university.com.localhost:3000/api/hostels');
        const data = await response.json();
        console.log("Status:", response.status);
        if (data.hostels) {
            console.log("Hostels fetched successfully:", data.hostels.length);
        } else {
            console.log("Error data:", data);
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

testHostels();
