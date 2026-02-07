const { MongoClient } = require('mongodb');

async function checkConnections() {
    const url = 'mongodb+srv://pankaj:pankajdwivedi81@cluster0.pqvmg4l.mongodb.net/?appName=Cluster0';
    const client = new MongoClient(url, {
        maxPoolSize: 1,
        serverSelectionTimeoutMS: 10000
    });

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();

        const admin = client.db('test').admin();
        const serverStatus = await admin.serverStatus();

        console.log('\n📊 MongoDB Connection Stats:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✓ Current Connections: ${serverStatus.connections.current}`);
        console.log(`✓ Available: ${serverStatus.connections.available}`);
        console.log(`✓ Total Created: ${serverStatus.connections.totalCreated}`);
        console.log(`✓ Active: ${serverStatus.connections.active || 'N/A'}`);

        const maxConnections = 500; // M0 tier limit
        const usagePercent = ((serverStatus.connections.current / maxConnections) * 100).toFixed(1);

        console.log('\n⚠️  Connection Usage:');
        console.log(`   ${serverStatus.connections.current} / ${maxConnections} (${usagePercent}%)`);

        if (usagePercent > 80) {
            console.log('\n🚨 CRITICAL: Connection usage above 80%!');
            console.log('   Actions:');
            console.log('   1. Restart all dev servers (Ctrl+C then npm run dev)');
            console.log('   2. Check for multiple running instances');
            console.log('   3. Wait 1-2 minutes for connections to close');
        } else if (usagePercent > 50) {
            console.log('\n⚠️  WARNING: Connection usage above 50%');
            console.log('   Consider restarting dev server soon');
        } else {
            console.log('\n✅ Connection usage is healthy');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    } finally {
        await client.close();
        console.log('\n🔌 Disconnected from MongoDB\n');
    }
}

checkConnections();
