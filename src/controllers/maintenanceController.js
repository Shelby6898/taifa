const { db, admin } = require("../config/firebase");

// GET all maintenance records
exports.getMaintenanceRecords = async (req, res) => {
  try {
    const snapshot = await db.collection("maintenance").get();
    let records = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const assetDoc = await db.collection("assets").doc(data.assetId).get();
        const assetName = assetDoc.exists ? assetDoc.data().name : "Unknown";
        const assetCode = assetDoc.exists ? assetDoc.data().assetCode : "-";
        const department = assetDoc.exists ? assetDoc.data().department : "-";
        return {
          id: doc.id,
          assetName,
          assetCode,
          department,
          ...data,
          scheduledDate: data.scheduledDate?.toDate().toISOString(),
          completedDate: data.completedDate?.toDate().toISOString() || null,
          createdAt: data.createdAt?.toDate().toISOString()
        };
      })
    );

    // Filter by department for non-admins
    if (req.user.role !== "admin" && req.user.department) {
      records = records.filter(r => r.department === req.user.department);
    }

    // Sort by scheduledDate desc
    records.sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET single maintenance record
exports.getMaintenanceRecord = async (req, res) => {
  try {
    const doc = await db.collection("maintenance").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Record not found" });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE maintenance record
exports.createMaintenanceRecord = async (req, res) => {
  try {
    const { assetId, type, description, scheduledDate, assignedTo, cost } = req.body;
    if (!assetId || !type || !scheduledDate) {
      return res.status(400).json({ success: false, message: "assetId, type and scheduledDate are required" });
    }

    const assetDoc = await db.collection("assets").doc(assetId).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const record = {
      assetId,
      type,
      description: description || "",
      scheduledDate: admin.firestore.Timestamp.fromDate(new Date(scheduledDate)),
      assignedTo: assignedTo || null,
      cost: cost || 0,
      status: "scheduled",
      completedDate: null,
      notes: "",
      createdBy: req.user.userId || "system",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection("maintenance").add(record);

    // Update asset status
    await db.collection("assets").doc(assetId).update({
      status: "maintenance",
      updatedAt: admin.firestore.Timestamp.now()
    });

    res.status(201).json({ success: true, id: docRef.id, message: "Maintenance record created" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE maintenance record
exports.updateMaintenanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("maintenance").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Record not found" });

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (req.body.scheduledDate) {
      updateData.scheduledDate = admin.firestore.Timestamp.fromDate(new Date(req.body.scheduledDate));
    }

    if (req.body.status === "completed") {
      updateData.completedDate = admin.firestore.Timestamp.now();
      // Restore asset to active
      await db.collection("assets").doc(doc.data().assetId).update({
        status: "active",
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    await docRef.update(updateData);
    res.json({ success: true, message: "Maintenance record updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE maintenance record
exports.deleteMaintenanceRecord = async (req, res) => {
  try {
    const doc = await db.collection("maintenance").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Record not found" });

    // Restore asset to active if it was in maintenance
    const assetDoc = await db.collection("assets").doc(doc.data().assetId).get();
    if (assetDoc.exists && assetDoc.data().status === "maintenance") {
      await db.collection("assets").doc(doc.data().assetId).update({
        status: "active",
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    await db.collection("maintenance").doc(req.params.id).delete();
    res.json({ success: true, message: "Maintenance record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
