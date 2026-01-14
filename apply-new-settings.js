const { MongoClient } = require('mongodb');

async function updateSettings() {
    const url = 'mongodb+srv://pankaj:pankajdwivedi81@cluster0.pqvmg4l.mongodb.net/?appName=Cluster0';
    const client = new MongoClient(url);

    try {
        await client.connect();
        const db = client.db('test');

        const locations = [
            { lat: 23.2483348, lng: 77.5026058, radius: 200, name: "Original Location" },
            { lat: 23.2475529, lng: 77.5035134, radius: 100, name: "Loc 1" },
            { lat: 23.2461544, lng: 77.5030323, radius: 100, name: "Loc 2" }
        ];

        // Remove old hostelLocation and add new hostelLocations
        const result = await db.collection('adminsettings').updateOne(
            {},
            {
                $set: {
                    hostelLocations: locations,
                    updatedAt: new Date()
                },
                $unset: {
                    hostelLocation: "",
                    radius: ""
                }
            },
            { upsert: true }
        );

        console.log("Admin Settings updated successfully:", result);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

updateSettings();
