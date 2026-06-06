const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/test').then(async () => {
  const perms = await mongoose.connection.db.collection('permissions').find().sort({createdAt: -1}).limit(5).toArray();
  console.log(JSON.stringify(perms, null, 2));
  process.exit();
}).catch(console.error);
