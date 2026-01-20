// Quick script to check locations in database
// Copy this into your browser console while on the dashboard

async function checkDatabaseLocations() {
    console.log("🔍 Checking database locations...\n");

    try {
        const response = await fetch("/api/admin/locations");
        const data = await response.json();

        console.log("📊 API Response:", data);
        console.log("\n📍 Total Locations:", data.count);
        console.log("\n🗂️ All Locations:");

        data.locations.forEach((loc, index) => {
            console.log(`\n${index + 1}. ${loc.name}`);
            console.log(`   Lat: ${loc.lat}`);
            console.log(`   Lng: ${loc.lng}`);
            console.log(`   Radius: ${loc.radius}m`);
        });

        // Check if "room1" exists
        const room1 = data.locations.find(loc =>
            loc.name.toLowerCase().includes("room1")
        );

        if (room1) {
            console.log("\n✅ Found 'room1' in database!");
            console.log("   Details:", room1);
        } else {
            console.log("\n❌ 'room1' NOT found in database!");
            console.log("   The location might not have been saved.");
        }

    } catch (error) {
        console.error("❌ Error fetching locations:", error);
    }
}

// Run the check
checkDatabaseLocations();
