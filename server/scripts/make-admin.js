/**
 * Make-Admin Script
 * Usage: node server/scripts/make-admin.js <email>
 * Example: node server/scripts/make-admin.js your@email.com
 */
require("dotenv").config({ path: "./env.local" });
const mongoose = require("mongoose");
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/zerohook";

async function makeAdmin(email) {
  if (!email) {
    console.error("Usage: node server/scripts/make-admin.js <email>");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const result = await mongoose.connection.collection("users").findOneAndUpdate(
    { email: email.toLowerCase() },
    { $set: { is_admin: true, role: "admin" } },
    { returnDocument: "after" }
  );

  if (!result) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`SUCCESS: User "${result.username}" (${result.email}) is now an admin.`);
  console.log("  is_admin:", result.is_admin);
  console.log("  role:", result.role);
  await mongoose.disconnect();
  process.exit(0);
}

makeAdmin(process.argv[2]).catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
