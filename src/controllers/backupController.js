const { db, bucket } = require("../config/firebase");

function serializeData(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return value;
  }));
}

exports.runBackup = async (req, res) => {
  try {
    const secret = req.headers["x-backup-secret"] || req.query.secret;
    if (!process.env.BACKUP_SECRET || secret !== process.env.BACKUP_SECRET) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const collections = await db.listCollections();
    const backupData = {};

    for (const collectionRef of collections) {
      const snapshot = await collectionRef.get();
      backupData[collectionRef.id] = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: serializeData(doc.data())
      }));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backups/backup-${timestamp}.json`;
    const file = bucket.file(fileName);

    await file.save(JSON.stringify(backupData, null, 2), {
      contentType: "application/json"
    });

    res.json({
      success: true,
      message: "Backup completed successfully",
      file: fileName,
      collections: Object.keys(backupData),
      timestamp
    });
  } catch (err) {
    console.error("Backup error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
