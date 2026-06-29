const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");

// Viewer raises an asset request
exports.createRequest = async (req, res) => {
  try {
    const { assetType, description, reason, urgency } = req.body;

    if (!assetType || !description || !reason) {
      return res.status(400).json({ success: false, message: "assetType, description and reason are required" });
    }

    if (!req.user.department) {
      return res.status(400).json({ success: false, message: "You must belong to a department to raise an asset request" });
    }

    const now = admin.firestore.Timestamp.now();

    const docRef = await db.collection("asset_requests").add({
      orgId: req.user.orgId,
      requestedBy: req.user.userId,
      requestedByName: req.user.name,
      department: req.user.department,
      assetType,
      description,
      reason,
      urgency: urgency || "NORMAL", // LOW, NORMAL, HIGH, URGENT
      status: "PENDING",
      approvedBy: null,
      approvedByName: null,
      rejectedReason: null,
      assignedAssetId: null,
      assignedAssetName: null,
      createdAt: now,
      updatedAt: now
    });

    // Notify managers and admins in the department
    await createNotification({
      type: "asset_request",
      title: "New Asset Request",
      message: `${req.user.name} has requested a ${assetType} — ${urgency || "NORMAL"} priority`,
      department: req.user.department,
      orgId: req.user.orgId,
      triggeredBy: req.user.name
    });

    res.status(201).json({
      success: true,
      message: "Asset request submitted successfully",
      requestId: docRef.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get asset requests — viewers see own, managers see department, admins see all
exports.getRequests = async (req, res) => {
  try {
    let query = db.collection("asset_requests").where("orgId", "==", req.user.orgId);

    if (req.user.role === "viewer") {
      query = query.where("requestedBy", "==", req.user.userId);
    } else if (req.user.role === "manager") {
      query = query.where("department", "==", req.user.department);
    }
    // admin and super-admin see all

    const snapshot = await query.get();
    const requests = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.createdAt?._seconds - a.createdAt?._seconds);

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single request
exports.getRequest = async (req, res) => {
  try {
    const doc = await db.collection("asset_requests").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Request not found" });

    const data = doc.data();
    if (data.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.status(200).json({ success: true, data: { id: doc.id, ...data } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Manager/Admin approves request and optionally assigns an asset
exports.approveRequest = async (req, res) => {
  try {
    const { assetId } = req.body;
    const docRef = db.collection("asset_requests").doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ success: false, message: "Request not found" });

    const request = doc.data();
    if (request.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    // Manager can only approve requests from their department
    if (req.user.role === "manager" && request.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only approve requests from your department" });
    }

    const now = admin.firestore.Timestamp.now();
    let assignedAssetName = null;

    const batch = db.batch();

    // If an asset is being assigned directly
    if (assetId) {
      const assetDoc = await db.collection("assets").doc(assetId).get();
      if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

      const asset = assetDoc.data();
      if (asset.orgId !== req.user.orgId) return res.status(404).json({ success: false, message: "Asset not found" });
      if (asset.status === "DISPOSED") return res.status(400).json({ success: false, message: "Cannot assign a disposed asset" });

      assignedAssetName = asset.name;

      // Close any open custody record
      const openCustody = await db.collection("asset_custody_logs")
        .where("assetId", "==", assetId)
        .where("endDate", "==", null)
        .get();
      openCustody.docs.forEach(d => batch.update(d.ref, { endDate: now }));

      // Open new custody record
      const custodyRef = db.collection("asset_custody_logs").doc();
      batch.set(custodyRef, {
        assetId,
        orgId: asset.orgId,
        custodianId: request.requestedBy,
        custodianName: request.requestedByName,
        startDate: now,
        endDate: null,
        purpose: request.description,
        type: "REQUEST_APPROVED",
        createdAt: now
      });

      // Update asset
      batch.update(db.collection("assets").doc(assetId), {
        custodian: request.requestedByName,
        custodianId: request.requestedBy,
        status: "ASSIGNED",
        previousStatus: asset.status,
        updatedAt: now
      });
    }

    // Update request
    batch.update(docRef, {
      status: "APPROVED",
      approvedBy: req.user.userId,
      approvedByName: req.user.name,
      assignedAssetId: assetId || null,
      assignedAssetName,
      updatedAt: now
    });

    await batch.commit();

    // Notify the requester
    await createNotification({
      type: "asset_request_approved",
      title: "Asset Request Approved",
      message: assetId
        ? `Your request for ${request.assetType} has been approved. ${assignedAssetName} has been assigned to you.`
        : `Your request for ${request.assetType} has been approved. An asset will be assigned to you shortly.`,
      department: request.department,
      orgId: request.orgId,
      triggeredBy: req.user.name
    });

    res.status(200).json({
      success: true,
      message: assetId
        ? `Request approved and ${assignedAssetName} assigned to ${request.requestedByName}`
        : `Request approved. Asset to be assigned separately.`,
      assignedAssetName
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Manager/Admin rejects request
exports.rejectRequest = async (req, res) => {
  try {
    const { rejectedReason } = req.body;

    if (!rejectedReason) {
      return res.status(400).json({ success: false, message: "rejectedReason is required" });
    }

    const docRef = db.collection("asset_requests").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Request not found" });

    const request = doc.data();
    if (request.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    if (req.user.role === "manager" && request.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only reject requests from your department" });
    }

    const now = admin.firestore.Timestamp.now();
    await docRef.update({
      status: "REJECTED",
      approvedBy: req.user.userId,
      approvedByName: req.user.name,
      rejectedReason,
      updatedAt: now
    });

    // Notify requester
    await createNotification({
      type: "asset_request_rejected",
      title: "Asset Request Rejected",
      message: `Your request for ${request.assetType} was rejected. Reason: ${rejectedReason}`,
      department: request.department,
      orgId: request.orgId,
      triggeredBy: req.user.name
    });

    res.status(200).json({ success: true, message: "Request rejected" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get pending requests count — for dashboard badge
exports.getPendingCount = async (req, res) => {
  try {
    let query = db.collection("asset_requests")
      .where("orgId", "==", req.user.orgId)
      .where("status", "==", "PENDING");

    if (req.user.role === "manager") {
      query = query.where("department", "==", req.user.department);
    }

    const snapshot = await query.get();
    res.status(200).json({ success: true, count: snapshot.size });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
