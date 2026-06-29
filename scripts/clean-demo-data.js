const { db } = require("../src/config/firebase");

// Collections to completely clear
const COLLECTIONS_TO_CLEAR = [
  "assets",
  "asset_audit",
  "asset_custody_logs",
  "asset_valuation_logs",
  "asset_disposals",
  "asset_documents",
  "asset_categories",
  "transfers",
  "maintenance",
  "depreciation",
  "notifications",
  "tickets",
  "ticket_comments",
  "otps",
  "passwordResets",
  "backups"
];

// Users to KEEP (by email)
const KEEP_USERS = [
  "admin@taifa.com",
  "john@taifa.com",
  "mary@taifa.com",
  "superadmin@taifatech.org"
];

async function deleteCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`  ✓ ${collectionName} — already empty`);
    return 0;
  }

  let deleted = 0;
  const batchSize = 400;
  let batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    deleted++;

    if (count >= batchSize) {
      await batch.commit();
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) await batch.commit();
  console.log(`  ✓ ${collectionName} — deleted ${deleted} documents`);
  return deleted;
}

async function cleanUsers() {
  const snapshot = await db.collection("users").get();
  if (snapshot.empty) {
    console.log("  ✓ users — already empty");
    return;
  }

  let kept = 0;
  let deleted = 0;
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const email = doc.data().email;
    if (KEEP_USERS.includes(email)) {
      // Reset user to clean state
      batch.update(doc.ref, {
        loginAttempts: 0,
        userStatus: "active",
        lastLoginAt: null,
        updatedAt: require("../src/config/firebase").admin.firestore.Timestamp.now()
      });
      console.log(`  ✓ keeping user: ${email}`);
      kept++;
    } else {
      batch.delete(doc.ref);
      deleted++;
      console.log(`  ✗ deleting user: ${email}`);
    }
  }

  await batch.commit();
  console.log(`  Users: kept ${kept}, deleted ${deleted}`);
}

async function main() {
  console.log("=".repeat(50));
  console.log("TAIFATECH — Demo Data Cleanup");
  console.log("=".repeat(50));
  console.log("");

  console.log("Clearing collections...");
  for (const col of COLLECTIONS_TO_CLEAR) {
    await deleteCollection(col);
  }

  console.log("");
  console.log("Cleaning users (keeping 3)...");
  await cleanUsers();

  console.log("");
  console.log("=".repeat(50));
  console.log("✅ Database cleaned successfully");
  console.log("Kept users:");
  KEEP_USERS.forEach(e => console.log("  - " + e));
  console.log("=".repeat(50));
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
