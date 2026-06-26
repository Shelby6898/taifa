const { db, admin } = require("../config/firebase");

// Assign a custodian to an asset — closes previous custody record, opens new one
exports.assignCustodian = async (req, res) => {
  try {
    const { id } = req.params;
    const { custodianId, custodianName, purpose } = req.body;

    if (!custodianId || !custodianName) {
      return res.status(400).json({ success: false, message: "custodianId and custodianName are required" });
    }

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot assign custodian to a disposed asset" });
    }

    const now = admin.firestore.Timestamp.now();

    // Close any open custody record for this asset
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("endDate", "==", null)
      .get();

    const batch = db.batch();

    openCustody.docs.forEach(doc => {
      batch.update(doc.ref, { endDate: now });
    });

    // Open new custody record
    const newCustodyRef = db.collection("asset_custody_logs").doc();
    batch.set(newCustodyRef, {
      assetId: id,
      orgId: asset.orgId,
      custodianId,
      custodianName,
      startDate: now,
      endDate: null,
      purpose: purpose || null,
      createdAt: now
    });

    // Update asset custodian and status
    batch.update(assetRef, {
      custodian: custodianName,
      custodianId,
      status: "ASSIGNED",
      previousStatus: asset.status,
      updatedAt: now
    });

    await batch.commit();

    // Audit log
    await db.collection("asset_audit").add({
      assetId: id,
      action: "custodian_assigned",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Custodian assigned: ${custodianName}`,
      oldData: { custodian: asset.custodian || null, status: asset.status },
      newData: { custodian: custodianName, status: "ASSIGNED" },
      timestamp: now
    });

    res.status(200).json({ success: true, message: `${custodianName} assigned as custodian`, custodyId: newCustodyRef.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Release custodian from an asset
exports.releaseCustodian = async (req, res) => {
  try {
    const { id } = req.params;

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const now = admin.firestore.Timestamp.now();

    // Close open custody record
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("endDate", "==", null)
      .get();

    const batch = db.batch();
    openCustody.docs.forEach(doc => {
      batch.update(doc.ref, { endDate: now });
    });

    // Update asset
    batch.update(assetRef, {
      custodian: null,
      custodianId: null,
      status: "UNASSIGNED",
      previousStatus: asset.status,
      updatedAt: now
    });

    await batch.commit();

    await db.collection("asset_audit").add({
      assetId: id,
      action: "custodian_released",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Custodian released: ${asset.custodian || "unknown"}`,
      oldData: { custodian: asset.custodian, status: asset.status },
      newData: { custodian: null, status: "UNASSIGNED" },
      timestamp: now
    });

    res.status(200).json({ success: true, message: "Custodian released, asset is now UNASSIGNED" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get full custody history for an asset
exports.getCustodyLog = async (req, res) => {
  try {
    const { id } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const snapshot = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .get();

    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.startDate?._seconds - a.startDate?._seconds);

    res.status(200).json({ success: true, assetId: id, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
