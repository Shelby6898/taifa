const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");
const validateCustodian = require("../utils/validateCustodian");

// Check out an asset to a user
exports.checkOut = async (req, res) => {
  try {
    const { id } = req.params;
    const { custodianId, custodianName, expectedReturnDate, purpose } = req.body;

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

    const validation = await validateCustodian(db, asset, custodianId, custodianName);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot check out a disposed asset" });
    }

    if (asset.status?.toLowerCase() === "maintenance") {
      return res.status(400).json({ success: false, message: "Cannot check out an asset under maintenance" });
    }

    if (asset.checkedOut) {
      return res.status(400).json({ success: false, message: `Asset is already checked out to ${asset.custodian}` });
    }

    const now = admin.firestore.Timestamp.now();
    const returnDate = expectedReturnDate
      ? admin.firestore.Timestamp.fromDate(new Date(expectedReturnDate))
      : null;

    // Close any open custody record
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("orgId", "==", asset.orgId)
      .where("endDate", "==", null)
      .get();

    const batch = db.batch();
    openCustody.docs.forEach(doc => {
      const custody = doc.data();
      if (!custody || custody.orgId !== asset.orgId) return;

      batch.update(doc.ref, { endDate: now });
    });

    // Open new custody record
    const custodyRef = db.collection("asset_custody_logs").doc();
    batch.set(custodyRef, {
      assetId: id,
      orgId: asset.orgId,
      custodianId,
      custodianName,
      startDate: now,
      endDate: null,
      expectedReturnDate: returnDate,
      purpose: purpose || null,
      type: "CHECKOUT",
      createdAt: now
    });

    // Update asset
    batch.update(assetRef, {
      status: "ASSIGNED",
      previousStatus: asset.status,
      custodian: custodianName,
      custodianId,
      checkedOut: true,
      checkedOutAt: now,
      expectedReturnDate: returnDate,
      flaggedMissing: false,
      flaggedInactive: false,
      updatedAt: now
    });

    await batch.commit();

    // Audit log
    await db.collection("asset_audit").add({
      assetId: id,
      action: "checked_out",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Checked out to ${custodianName}${expectedReturnDate ? `, expected return: ${expectedReturnDate}` : ""}`,
      oldData: { status: asset.status, custodian: asset.custodian || null },
      newData: { status: "ASSIGNED", custodian: custodianName },
      timestamp: now
    });

    await createNotification({
      type: "asset_checkout",
      title: "Asset Checked Out",
      message: `"${asset.name}" checked out to ${custodianName}`,
      department: asset.department,
      orgId: asset.orgId,
      assetId: id,
      assetName: asset.name,
      triggeredBy: req.user.name || "Admin"
    });

    res.status(200).json({
      success: true,
      message: `Asset "${asset.name}" checked out to ${custodianName}`,
      custodyId: custodyRef.id,
      expectedReturnDate: returnDate
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check in an asset — returns it to store
exports.checkIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition, notes } = req.body;

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (!asset.checkedOut) {
      return res.status(400).json({ success: false, message: "Asset is not currently checked out" });
    }

    const now = admin.firestore.Timestamp.now();

    // Close open custody record
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("endDate", "==", null)
      .get();

    const batch = db.batch();
    openCustody.docs.forEach(doc => {
      const custody = doc.data();
      if (!custody || custody.orgId !== asset.orgId) return;

      batch.update(doc.ref, {
        endDate: now,
        returnCondition: condition || null,
        returnNotes: notes || null
      });
    });

    // Update asset
    batch.update(assetRef, {
      status: "UNASSIGNED",
      previousStatus: asset.status,
      custodian: null,
      custodianId: null,
      checkedOut: false,
      checkedOutAt: null,
      expectedReturnDate: null,
      flaggedMissing: false,
      flaggedInactive: false,
      lastReturnCondition: condition || null,
      updatedAt: now
    });

    await batch.commit();

    await db.collection("asset_audit").add({
      assetId: id,
      action: "checked_in",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Checked in by ${req.user.name || "Admin"}${condition ? `, condition: ${condition}` : ""}`,
      oldData: { status: asset.status, custodian: asset.custodian },
      newData: { status: "UNASSIGNED", custodian: null },
      timestamp: now
    });

    await createNotification({
      type: "asset_checkin",
      title: "Asset Checked In",
      message: `"${asset.name}" has been returned`,
      department: asset.department,
      orgId: asset.orgId,
      assetId: id,
      assetName: asset.name,
      triggeredBy: req.user.name || "Admin"
    });

    res.status(200).json({
      success: true,
      message: `Asset "${asset.name}" checked in successfully`,
      condition: condition || null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Flag asset as missing
exports.flagMissing = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Asset is already disposed" });
    }

    const now = admin.firestore.Timestamp.now();

    await assetRef.update({
      flaggedMissing: true,
      flaggedMissingAt: now,
      flaggedMissingReason: reason || null,
      flaggedMissingBy: req.user.name || "Admin",
      updatedAt: now
    });

    await db.collection("asset_audit").add({
      assetId: id,
      action: "flagged_missing",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Flagged as missing by ${req.user.name || "Admin"}${reason ? `: ${reason}` : ""}`,
      oldData: { flaggedMissing: false },
      newData: { flaggedMissing: true, reason },
      timestamp: now
    });

    await createNotification({
      type: "alert",
      title: "Asset Flagged Missing",
      message: `"${asset.name}" (${asset.assetCode}) has been flagged as missing`,
      department: asset.department,
      orgId: asset.orgId,
      assetId: id,
      assetName: asset.name,
      triggeredBy: req.user.name || "Admin"
    });

    res.status(200).json({ success: true, message: `Asset "${asset.name}" flagged as missing` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Flag asset as inactive
exports.flagInactive = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const now = admin.firestore.Timestamp.now();

    await assetRef.update({
      flaggedInactive: true,
      flaggedInactiveAt: now,
      flaggedInactiveReason: reason || null,
      flaggedInactiveBy: req.user.name || "Admin",
      updatedAt: now
    });

    await db.collection("asset_audit").add({
      assetId: id,
      action: "flagged_inactive",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Flagged as inactive by ${req.user.name || "Admin"}${reason ? `: ${reason}` : ""}`,
      oldData: { flaggedInactive: false },
      newData: { flaggedInactive: true, reason },
      timestamp: now
    });

    res.status(200).json({ success: true, message: `Asset "${asset.name}" flagged as inactive` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all checked out assets for org
exports.getCheckedOutAssets = async (req, res) => {
  try {
    const snapshot = await db.collection("assets")
      .where("orgId", "==", req.user.orgId)
      .where("checkedOut", "==", true)
      .get();

    const assets = snapshot.docs
      .map(doc => ({ assetId: doc.id, ...doc.data() }))
      .sort((a, b) => b.checkedOutAt?._seconds - a.checkedOutAt?._seconds);

    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all flagged assets (missing or inactive)
exports.getFlaggedAssets = async (req, res) => {
  try {
    const snapshot = await db.collection("assets")
      .where("orgId", "==", req.user.orgId)
      .get();

    const assets = snapshot.docs
      .map(doc => ({ assetId: doc.id, ...doc.data() }))
      .filter(a => a.flaggedMissing || a.flaggedInactive);

    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
