require("dotenv").config();
const { db, admin } = require("../src/config/firebase");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const WARDS = ["Kabuchai", "Bungoma Central", "Bungoma East", "Bungoma North", "Bungoma South", "Bungoma West", "Musikoma", "Chwele", "Malakisi", "Lwandanyi", "Sirisia", "Namwela", "Maliki", "Tongaren", "Ndivisi", "Maeni", "Milima", "Kimilili", "Kibingei", "Kamukuywa", "Bumula", "Butula", "Nzoia", "Khalaba", "Kimaeti", "Mihuu", "Bokoli", "Kanduyi", "Soysambu", "Teso North", "Teso South", "Anyange", "Chakol North", "Chakol South", "Nambale", "Bukhayo North", "Bukhayo Central", "Bukhayo East", "Mt Elgon", "Kapsokwony", "Cheptais", "Kaptama", "Chesikaki", "Elgon"];
const DEPARTMENTS = ["Finance", "ICT", "Health", "Education", "Roads", "Water", "Administration", "Revenue", "Agriculture"];

async function run() {
  // 1. Create or find Bungoma County organization
  let orgId;
  const existingOrg = await db.collection("organizations").where("name", "==", "Bungoma County").get();
  if (!existingOrg.empty) {
    orgId = existingOrg.docs[0].id;
    console.log("Bungoma County org already exists:", orgId);
  } else {
    const orgRef = await db.collection("organizations").add({
      name: "Bungoma County",
      type: "county",
      locationLabel: "Ward",
      locationLabelPlural: "Wards",
      unitLabel: "Department",
      unitLabelPlural: "Departments",
      locations: WARDS,
      units: DEPARTMENTS,
      status: "active",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });
    orgId = orgRef.id;
    console.log("Created Bungoma County org:", orgId);
  }

  // 2. Tag existing documents with orgId
  const collectionsToTag = [
    "users", "assets", "transfers", "maintenance", "tickets",
    "notifications", "asset_audit", "ticket_audit", "user_audit"
  ];

  for (const colName of collectionsToTag) {
    const snapshot = await db.collection(colName).get();
    let batch = db.batch();
    let count = 0;
    let opCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.orgId) continue;
      batch.update(doc.ref, { orgId });
      opCount++;
      count++;
      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }
    if (opCount > 0) await batch.commit();
    console.log(`Tagged ${count} documents in '${colName}' with orgId`);
  }

  // 3. Create super-admin user if not exists
  const superAdminEmail = "superadmin@taifatech.org";
  const existingSuper = await db.collection("users").where("email", "==", superAdminEmail).get();
  if (!existingSuper.empty) {
    console.log("Super-admin already exists:", superAdminEmail);
  } else {
    const password = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection("users").add({
      name: "Super Admin",
      email: superAdminEmail,
      passwordHash,
      role: "super-admin",
      department: null,
      orgId: null,
      createdAt: admin.firestore.Timestamp.now()
    });
    console.log("=================================================");
    console.log("Super-admin account created:");
    console.log("  Email:", superAdminEmail);
    console.log("  Password:", password);
    console.log("  SAVE THIS PASSWORD NOW - it will not be shown again");
    console.log("=================================================");
  }

  console.log("Migration complete.");
  process.exit(0);
}

run().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
