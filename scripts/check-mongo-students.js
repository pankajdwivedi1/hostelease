const { MongoClient } = require('mongodb');

const directUri = "mongodb://pankaj:pankajdwivedi81@cluster0-shard-00-00.pqvmg4l.mongodb.net:27017,cluster0-shard-00-01.pqvmg4l.mongodb.net:27017,cluster0-shard-00-02.pqvmg4l.mongodb.net:27017/test?ssl=true&replicaSet=atlas-13d80m-shard-0&authSource=admin&retryWrites=true&w=majority";

async function run() {
  const client = new MongoClient(directUri);
  try {
    console.log("Connecting directly to MongoDB Atlas replica set...");
    await client.connect();
    console.log("🎉 CONNECTED TO MONGODB ATLAS!");

    const adminDb = client.db().admin();
    const dbs = await adminDb.listDatabases();
    console.log("Databases in MongoDB:", dbs.databases.map(d => d.name));

    for (const dbInfo of dbs.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      console.log(`\n📁 DB "${dbInfo.name}" Collections:`, collections.map(c => c.name));

      for (const colInfo of collections) {
        if (colInfo.name.toLowerCase().includes('student')) {
          const col = db.collection(colInfo.name);
          const count = await col.countDocuments();
          console.log(`   📊 Collection "${colInfo.name}" in DB "${dbInfo.name}" has ${count} documents.`);
          const sample = await col.findOne({ fatherName: { $exists: true, $ne: "" } }) || await col.findOne();
          console.log(`   Sample document from "${colInfo.name}":`, sample);
        }
      }
    }

  } catch (err) {
    console.error("MongoDB Atlas Direct Error:", err.message);
  } finally {
    await client.close();
  }
}

run();
