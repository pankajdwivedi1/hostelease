const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://localhost:27017/hostel'); // Wait, I need the actual connection string.
    // I'll check lib/mongodb.ts for the connection string or environment variable.
}
