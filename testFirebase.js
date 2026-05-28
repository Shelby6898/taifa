const { db } = require("./src/config/firebase");

async function testFirestore() {
  try {
    const snapshot = await db
      .collection("assets")
      .limit(1)
      .get();

    console.log("✅ Firestore connected successfully");
    console.log(`Documents found: ${snapshot.size}`);
  } catch (error) {
    console.error("❌ Firestore connection failed");
    console.error(error);
  }
}

testFirestore();
