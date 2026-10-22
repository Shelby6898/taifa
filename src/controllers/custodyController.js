const { db, admin } = require("../config/firebase");
const cache = require("../utils/cache");
const validateCustodian = require("../utils/validateCustodian");

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

    const validation = await validateCustodian(db, asset, custodianId, custodianName);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const now = admin.firestore.Timestamp.now();

    // Close any open custody record for this asset
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("orgId", "==", asset.orgId)
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

    cache.delPrefix(`summary:${asset.orgId}`);
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

    cache.delPrefix(`summary:${asset.orgId}`);
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

// Reallocate asset directly from one custodian to another — single atomic operation
exports.reallocateCustodian = async (req, res) => {
  try {
    const { id } = req.params;
    const { newCustodianId, newCustodianName, reason } = req.body;

    if (!newCustodianId || !newCustodianName || !reason) {
      return res.status(400).json({ success: false, message: "newCustodianId, newCustodianName and reason are required" });
    }

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot reallocate a disposed asset" });
    }

    const validation = await validateCustodian(db, asset, newCustodianId, newCustodianName);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    if (!asset.custodian) {
      return res.status(400).json({ success: false, message: "Asset has no current custodian to reallocate from. Use assign custodian instead." });
    }

    if (asset.custodianId === newCustodianId) {
      return res.status(400).json({ success: false, message: "Asset is already assigned to this custodian" });
    }

    const now = admin.firestore.Timestamp.now();
    const previousCustodian = asset.custodian;

    const batch = db.batch();

    // Close current custody record
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("orgId", "==", asset.orgId)
      .where("endDate", "==", null)
      .get();

    openCustody.docs.forEach(doc => {
      batch.update(doc.ref, { endDate: now, reallocationReason: reason });
    });

    // Open new custody record
    const newCustodyRef = db.collection("asset_custody_logs").doc();
    batch.set(newCustodyRef, {
      assetId: id,
      orgId: asset.orgId,
      custodianId: newCustodianId,
      custodianName: newCustodianName,
      startDate: now,
      endDate: null,
      purpose: reason,
      type: "REALLOCATION",
      reallocatedFrom: previousCustodian,
      createdAt: now
    });

    // Update asset
    batch.update(assetRef, {
      custodian: newCustodianName,
      custodianId: newCustodianId,
      status: "ASSIGNED",
      updatedAt: now
    });

    await batch.commit();

    await db.collection("asset_audit").add({
      assetId: id,
      action: "reallocated",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Reallocated from ${previousCustodian} to ${newCustodianName}: ${reason}`,
      oldData: { custodian: previousCustodian },
      newData: { custodian: newCustodianName },
      timestamp: now
    });

    cache.delPrefix(`summary:${asset.orgId}`);
    res.status(200).json({
      success: true,
      message: `Asset reallocated from ${previousCustodian} to ${newCustodianName}`,
      custodyId: newCustodyRef.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Deactivate an asset — temporarily withdrawn from use, not disposed
exports.deactivateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: "reason is required" });
    }

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot deactivate a disposed asset" });
    }

    if (asset.status === "DEACTIVATED") {
      return res.status(400).json({ success: false, message: "Asset is already deactivated" });
    }

    const now = admin.firestore.Timestamp.now();

    await assetRef.update({
      status: "DEACTIVATED",
      previousStatus: asset.status,
      deactivatedAt: now,
      deactivatedBy: req.user.name || "Admin",
      deactivationReason: reason,
      updatedAt: now
    });

    await db.collection("asset_audit").add({
      assetId: id,
      action: "deactivated",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Deactivated: ${reason}`,
      oldData: { status: asset.status },
      newData: { status: "DEACTIVATED" },
      timestamp: now
    });

    cache.delPrefix(`summary:${asset.orgId}`);
    res.status(200).json({ success: true, message: `Asset "${asset.name}" deactivated` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reactivate a previously deactivated asset
exports.activateAsset = async (req, res) => {
  try {
    const { id } = req.params;

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status !== "DEACTIVATED") {
      return res.status(400).json({ success: false, message: "Asset is not deactivated" });
    }

    const now = admin.firestore.Timestamp.now();
    const restoredStatus = asset.custodian ? "ASSIGNED" : (asset.previousStatus || "UNASSIGNED");

    await assetRef.update({
      status: restoredStatus,
      previousStatus: "DEACTIVATED",
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
      updatedAt: now
    });

    await db.collection("asset_audit").add({
      assetId: id,
      action: "activated",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Reactivated, restored to ${restoredStatus}`,
      oldData: { status: "DEACTIVATED" },
      newData: { status: restoredStatus },
      timestamp: now
    });

    cache.delPrefix(`summary:${asset.orgId}`);
    res.status(200).json({ success: true, message: `Asset "${asset.name}" reactivated`, status: restoredStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
