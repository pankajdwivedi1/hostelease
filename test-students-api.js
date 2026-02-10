// Quick test to check if the students API is working
async function testStudentsAPI() {
    try {
        console.log("Testing /api/students?light=true endpoint...");

        const response = await fetch("http://localhost:3000/api/students?light=true");

        console.log("Status:", response.status);

        if (!response.ok) {
            const text = await response.text();
            console.error("Error response:", text);
            return;
        }

        const data = await response.json();
        console.log("Success! Got", data.students?.length || 0, "students");

        if (data.students && data.students.length > 0) {
            console.log("First student sample:", {
                name: data.students[0].name,
                email: data.students[0].email,
                phoneNumber: data.students[0].phoneNumber,
                hasPhone: !!data.students[0].phoneNumber
            });
        }

    } catch (error) {
        console.error("Failed to test API:", error.message);
    }
}

testStudentsAPI();
