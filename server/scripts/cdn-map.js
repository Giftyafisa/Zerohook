const mongoose = require('mongoose');
(async() => {
  await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS:15000,socketTimeoutMS:45000});
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  for (const {name} of cols) {
    const query = {cloudinary_public_id: {$exists: true, $ne: null}};
    const cnt = await db.collection(name).countDocuments(query);
    if (cnt > 0) {
      console.log(name, cnt);
      const sample = await db.collection(name).find(query).project({user_id:1,cloudinary_public_id:1,created_at:1,username:1}).limit(5).toArray();
      console.log(JSON.stringify(sample, null, 2));
    }
  }
  await mongoose.disconnect();
  process.exit(0);
})();
