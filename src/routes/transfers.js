const express = require("express");
const router = express.Router();
const {
  getTransfers,
  createTransfer,
  approveTransfer,
  denyTransfer
} = require("../controllers/transferController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");
const { db, admin } = require("../config/firebase");

router.use(authenticate);

router.get("/",    getTransfers);
router.post("/",   authorizeWrite("admin", "manager"), createTransfer);
router.patch("/:id/approve", authorizeWrite("admin"), approveTransfer);
router.patch("/:id/deny",    authorizeWrite("admin"), denyTransfer);

// DIRECT TRANSFER (admin only) - executes immediately and logs record
router.post("/direct", authenticate, authorizeWrite("admin"), async (req, res) => {
  try {
    const { assetId, toWard, toDepartment, reason } = req.body;
    if (!assetId || !toWard || !toDepartment) {
      return res.status(400).json({ success: false, message: "assetId, toWard and toDepartment are required" });
    }

    const assetDoc = await db.collection("assets").doc(assetId).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });
    const asset = assetDoc.data();

    if (asset.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const requesterDoc = await db.collection("users").doc(req.user.userId).get();
    const requesterName = requesterDoc.exists ? requesterDoc.data().name : "Admin";

    // Execute transfer immediately - clear assignedTo
    await db.collection("assets").doc(assetId).update({
      ward: toWard,
      department: toDepartment,
      assignedTo: null,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Create transfer record as approved
    await db.collection("transfers").add({
      orgId: asset.orgId,
      assetId,
      assetName: asset.name,
      assetCode: asset.assetCode || "",
      fromWard: asset.ward,
      fromDepartment: asset.department,
      toWard,
      toDepartment,
      reason: reason || "Direct transfer by admin",
      status: "approved",
      requestedBy: req.user.userId,
      requestedByName: requesterName,
      approvedBy: req.user.userId,
      approvedByName: requesterName,
      approvedAt: admin.firestore.Timestamp.now(),
      deniedReason: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Audit log
    await db.collection("asset_audit").add({
      assetId,
      orgId: asset.orgId,
      action: "transfer",
      changedBy: req.user.userId,
      reason: reason || "Direct transfer by admin",
      oldData: { ward: asset.ward, department: asset.department },
      newData: { ward: toWard, department: toDepartment },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Asset transferred successfully." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
