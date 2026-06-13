const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");
const { sendEmail } = require("../services/email");

// ─────────────────────────────────────────
//  GET ALL TRANSFERS (includes pending)
// ─────────────────────────────────────────
exports.getTransfers = async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await db.collection("transfers")
        
        .get();
    } catch (e) {
      // Collection may not exist yet
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const transfers = (await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const assetDoc = await db.collection("assets").doc(data.assetId).get();
        const assetName = assetDoc.exists ? assetDoc.data().name : "Unknown";
        return { id: doc.id, assetName, ...data };
      })
    )).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));

    // Organization isolation
    const orgFiltered = user => transfers.filter(t => user.role === "super-admin" || t.orgId === user.orgId);

    // Role-based filtering
    const user = req.user;
    const orgScoped = orgFiltered(user);
    const filtered = user.role === "admin" || user.role === "super-admin"
      ? orgScoped
      : user.role === "manager"
        ? orgScoped.filter(t =>
            t.fromDepartment === user.department ||
            t.toDepartment === user.department
          )
        : orgScoped.filter(t => t.requestedBy === user.userId);

    res.status(200).json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  CREATE TRANSFER REQUEST (pending)
// ─────────────────────────────────────────
exports.createTransfer = async (req, res) => {
  try {
    const { assetId, toWard, toDepartment, reason } = req.body;

    if (!assetId || !toWard || !toDepartment) {
      return res.status(400).json({
        success: false,
        message: "assetId, toWard and toDepartment are required"
      });
    }

    const assetDoc = await db.collection("assets").doc(assetId).get();
    if (!assetDoc.exists) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const asset = assetDoc.data();

    if (req.user.role !== "super-admin" && asset.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    // Manager can only request transfer for their department assets
    if (req.user.role !== "admin" && req.user.department &&
        asset.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: "You can only transfer assets from your department"
      });
    }

    // Get requester info
    const requesterDoc = await db.collection("users").doc(req.user.userId).get();
    const requesterName = requesterDoc.exists ? requesterDoc.data().name : "Unknown";

    const transferRef = await db.collection("transfers").add({
      orgId: asset.orgId,
      assetId,
      assetName:        asset.name,
      assetCode:        asset.assetCode || "",
      fromWard:         asset.ward,
      fromDepartment:   asset.department,
      toWard,
      toDepartment,
      reason:           reason || "Not specified",
      status:           "pending",
      requestedBy:      req.user.userId,
      requestedByName:  requesterName,
      approvedBy:       null,
      approvedByName:   null,
      deniedReason:     null,
      createdAt:        admin.firestore.Timestamp.now(),
      updatedAt:        admin.firestore.Timestamp.now()
    });

    // Notify all admins in this organization about pending transfer request
    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
    const adminEmails = adminsSnap.docs
      .filter(d => d.data().orgId === asset.orgId)
      .map(d => d.data().email);

    if (adminEmails.length) {
      await sendEmail({
        to: adminEmails,
        subject: `📦 Transfer Request: ${asset.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#6366f1;">Taifa — Transfer Request</h2>
            <p>A new asset transfer request requires your approval.</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
              <p><strong>Asset:</strong> ${asset.name} (${asset.assetCode || ""})</p>
              <p><strong>From:</strong> ${asset.department} — ${asset.ward}</p>
              <p><strong>To:</strong> ${toDepartment} — ${toWard}</p>
              <p><strong>Requested by:</strong> ${requesterName}</p>
              <p><strong>Reason:</strong> ${reason || "Not specified"}</p>
            </div>
            <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Review Request →</a>
          </div>
        `
      });
    }

    await createNotification({
      type: "transfer_request",
      title: "Transfer Request Pending",
      message: `${requesterName} requested transfer of ${asset.name} from ${asset.department} to ${toDepartment}`,
      department: "all",
      orgId: asset.orgId,
      assetId,
      assetName: asset.name,
      triggeredBy: requesterName
    });

    res.status(201).json({
      success: true,
      message: "Transfer request submitted. Awaiting admin approval.",
      id: transferRef.id
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  APPROVE TRANSFER (admin only)
// ─────────────────────────────────────────
exports.approveTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const transferRef = db.collection("transfers").doc(id);
    const transferDoc = await transferRef.get();

    if (!transferDoc.exists) {
      return res.status(404).json({ success: false, message: "Transfer request not found" });
    }

    const transfer = transferDoc.data();

    if (req.user.role !== "super-admin" && transfer.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Transfer request not found" });
    }

    if (transfer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Transfer is already ${transfer.status}`
      });
    }

    // Get approver info
    const approverDoc = await db.collection("users").doc(req.user.userId).get();
    const approverName = approverDoc.exists ? approverDoc.data().name : "Admin";

    // Execute the transfer — update the asset, clear assignedTo
    const assetRef = db.collection("assets").doc(transfer.assetId);
    await assetRef.update({
      ward:        transfer.toWard,
      department:  transfer.toDepartment,
      assignedTo:  null,
      updatedAt:   admin.firestore.Timestamp.now()
    });

    // Update transfer record
    await transferRef.update({
      status:        "approved",
      approvedBy:    req.user.userId,
      approvedByName: approverName,
      approvedAt:    admin.firestore.Timestamp.now(),
      updatedAt:     admin.firestore.Timestamp.now()
    });

    // Audit log
    const assetDoc = await assetRef.get();
    await db.collection("asset_audit").add({
      assetId:   transfer.assetId,
      action:    "transfer",
      changedBy: req.user.userId,
      orgId:     transfer.orgId,
      reason:    transfer.reason,
      oldData:   { ward: transfer.fromWard, department: transfer.fromDepartment },
      newData:   { ward: transfer.toWard,   department: transfer.toDepartment },
      timestamp: admin.firestore.Timestamp.now()
    });

    // Email requester
    const requesterDoc = await db.collection("users").doc(transfer.requestedBy).get();
    if (requesterDoc.exists) {
      await sendEmail({
        to: requesterDoc.data().email,
        subject: `✅ Transfer Approved: ${transfer.assetName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#10b981;">Taifa — Transfer Approved</h2>
            <p>Hi ${transfer.requestedByName},</p>
            <p>Your transfer request has been <strong style="color:#10b981;">approved</strong>.</p>
            <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0;">
              <p><strong>Asset:</strong> ${transfer.assetName}</p>
              <p><strong>From:</strong> ${transfer.fromDepartment} — ${transfer.fromWard}</p>
              <p><strong>To:</strong> ${transfer.toDepartment} — ${transfer.toWard}</p>
              <p><strong>Approved by:</strong> ${approverName}</p>
            </div>
            <p>The asset has been moved to the new department.</p>
          </div>
        `
      });
    }

    await createNotification({
      type: "transfer_approved",
      title: "Transfer Approved",
      message: `Transfer of ${transfer.assetName} to ${transfer.toDepartment} approved by ${approverName}`,
      department: transfer.fromDepartment,
      orgId: transfer.orgId,
      assetId: transfer.assetId,
      assetName: transfer.assetName,
      triggeredBy: approverName,
      targetUserId: transfer.requestedBy
    });
    // Also notify receiving department
    await createNotification({
      type: "transfer_in",
      title: "Asset Transferred In",
      message: `${transfer.assetName} has been transferred to your department from ${transfer.fromDepartment}`,
      department: transfer.toDepartment,
      orgId: transfer.orgId,
      assetId: transfer.assetId,
      assetName: transfer.assetName,
      fromDept: transfer.fromDepartment,
      toDept: transfer.toDepartment,
      triggeredBy: approverName
    });

    await db.collection("asset_audit").add({
      assetId: transfer.assetId,
      action: "transfer_approved",
      changedBy: req.user.userId,
      orgId: transfer.orgId,
      reason: transfer.reason,
      oldData: { ward: transfer.fromWard, department: transfer.fromDepartment },
      newData: { ward: transfer.toWard, department: transfer.toDepartment },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({
      success: true,
      message: "Transfer approved and executed successfully."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────
//  DENY TRANSFER (admin only)
// ─────────────────────────────────────────
exports.denyTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const transferRef = db.collection("transfers").doc(id);
    const transferDoc = await transferRef.get();

    if (!transferDoc.exists) {
      return res.status(404).json({ success: false, message: "Transfer request not found" });
    }

    const transfer = transferDoc.data();

    if (req.user.role !== "super-admin" && transfer.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Transfer request not found" });
    }

    if (transfer.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Transfer is already ${transfer.status}`
      });
    }

    const approverDoc = await db.collection("users").doc(req.user.userId).get();
    const approverName = approverDoc.exists ? approverDoc.data().name : "Admin";

    await transferRef.update({
      status:        "denied",
      approvedBy:    req.user.userId,
      approvedByName: approverName,
      deniedReason:  reason || "No reason provided",
      deniedAt:      admin.firestore.Timestamp.now(),
      updatedAt:     admin.firestore.Timestamp.now()
    });

    // Email requester
    const requesterDoc = await db.collection("users").doc(transfer.requestedBy).get();
    if (requesterDoc.exists) {
      await sendEmail({
        to: requesterDoc.data().email,
        subject: `❌ Transfer Denied: ${transfer.assetName}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#ef4444;">Taifa — Transfer Denied</h2>
            <p>Hi ${transfer.requestedByName},</p>
            <p>Your transfer request has been <strong style="color:#ef4444;">denied</strong>.</p>
            <div style="background:#fef2f2;border-radius:8px;padding:16px;margin:20px 0;">
              <p><strong>Asset:</strong> ${transfer.assetName}</p>
              <p><strong>From:</strong> ${transfer.fromDepartment} — ${transfer.fromWard}</p>
              <p><strong>To:</strong> ${transfer.toDepartment} — ${transfer.toWard}</p>
              <p><strong>Denied by:</strong> ${approverName}</p>
              <p><strong>Reason:</strong> ${reason || "No reason provided"}</p>
            </div>
            <p>Please contact your administrator for more information.</p>
          </div>
        `
      });
    }

    await createNotification({
      type: "transfer_denied",
      title: "Transfer Denied",
      message: `Transfer of ${transfer.assetName} denied by ${approverName}. Reason: ${reason || "No reason provided"}`,
      department: transfer.fromDepartment,
      orgId: transfer.orgId,
      assetId: transfer.assetId,
      assetName: transfer.assetName,
      triggeredBy: approverName,
      targetUserId: transfer.requestedBy
    });

    await db.collection("asset_audit").add({
      assetId: transfer.assetId,
      action: "transfer_denied",
      changedBy: req.user.userId,
      orgId: transfer.orgId,
      reason: reason || "No reason provided",
      oldData: { status: "pending" },
      newData: { status: "denied", deniedReason: reason },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({
      success: true,
      message: "Transfer request denied."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
