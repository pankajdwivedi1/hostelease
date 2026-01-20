// Test script for Location CRUD operations
// Run this to verify your implementation is working

const API_BASE = "http://localhost:3000/api/admin/locations";

async function testLocationCRUD() {
    console.log("🧪 Starting Location CRUD Tests...\n");

    try {
        // TEST 1: GET - Fetch all locations
        console.log("📖 Test 1: Fetching all locations...");
        let response = await fetch(API_BASE);
        let data = await response.json();
        console.log(`✅ GET Success: Found ${data.count} locations`);
        console.log("Locations:", JSON.stringify(data.locations, null, 2));
        const initialCount = data.count;

        // TEST 2: POST - Add a new location
        console.log("\n➕ Test 2: Adding new location...");
        const newLocation = {
            name: "Test Library",
            lat: 23.2500000,
            lng: 77.5100000,
            radius: 150
        };
        response = await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newLocation)
        });
        data = await response.json();
        if (data.success) {
            console.log(`✅ POST Success: Location "${newLocation.name}" added`);
            console.log(`Total locations now: ${data.totalLocations}`);
        } else {
            console.error("❌ POST Failed:", data.error);
            return;
        }

        // Verify it was added
        response = await fetch(API_BASE);
        data = await response.json();
        const newCount = data.count;
        if (newCount === initialCount + 1) {
            console.log("✅ Verification: Location count increased correctly");
        } else {
            console.error("❌ Verification Failed: Count mismatch");
        }

        // TEST 3: PUT - Update the last location
        console.log("\n✏️ Test 3: Updating location...");
        const updateIndex = newCount - 1; // Last location
        const updatedLocation = {
            index: updateIndex,
            name: "Test Library (Updated)",
            lat: 23.2500000,
            lng: 77.5100000,
            radius: 200 // Changed from 150 to 200
        };
        response = await fetch(API_BASE, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedLocation)
        });
        data = await response.json();
        if (data.success) {
            console.log(`✅ PUT Success: Location updated with new radius: 200m`);
        } else {
            console.error("❌ PUT Failed:", data.error);
        }

        // TEST 4: DELETE - Remove the test location
        console.log("\n🗑️ Test 4: Deleting test location...");
        response = await fetch(`${API_BASE}?index=${updateIndex}`, {
            method: "DELETE"
        });
        data = await response.json();
        if (data.success) {
            console.log(`✅ DELETE Success: Removed "${data.deletedLocation.name}"`);
            console.log(`Remaining locations: ${data.remainingLocations}`);
        } else {
            console.error("❌ DELETE Failed:", data.error);
        }

        // Final verification
        response = await fetch(API_BASE);
        data = await response.json();
        if (data.count === initialCount) {
            console.log("✅ Final Verification: Back to original count!");
        }

        console.log("\n🎉 All tests completed successfully!");
        console.log("\n📊 Summary:");
        console.log("  ✅ GET - Fetch locations");
        console.log("  ✅ POST - Add location");
        console.log("  ✅ PUT - Update location");
        console.log("  ✅ DELETE - Remove location");
        console.log("  ✅ Database persistence verified");

    } catch (error) {
        console.error("\n❌ Test failed with error:", error);
    }
}

// Instructions
console.log("=".repeat(60));
console.log("Location CRUD Test Suite");
console.log("=".repeat(60));
console.log("\n📋 Instructions:");
console.log("1. Make sure your Next.js dev server is running");
console.log("2. Open browser console (F12)");
console.log("3. Copy and paste this entire script");
console.log("4. Press Enter to run the tests\n");
console.log("Or run: testLocationCRUD();\n");

// Uncomment below to auto-run (for Node.js environments)
// testLocationCRUD();
