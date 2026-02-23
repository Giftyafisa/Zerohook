/**
 * Make-Admin Script
 * Usage: node server/scripts/make-admin.js <email>
 * Example: node server/scripts/make-admin.js your@email.com
 */
const path = require("path");
// Try multiple env file locations so the script works from project root OR server/
const envPaths = [
  path.resolve(__dirname, "../env.local"),
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), "env.local"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
];
for (const p of envPaths) {
  const result = require("dotenv").config({ path: p });
  if (!result.error) { console.log("Loaded env from:", p); break; }
}
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
