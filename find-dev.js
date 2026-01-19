const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function check() {
    await mongoose.connect(process.env.MONGODB_URL);
    const students = await mongoose.connection.db.collection('students').find({ name: /Pankaj/i }).toArray();
    console.log(JSON.stringify(students, null, 2));
    process.exit(0);
}

check();
