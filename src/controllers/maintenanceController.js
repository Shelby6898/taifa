const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");
const { sendEmail } = require("../services/email");

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

    // Organization isolation
    if (req.user.role !== "super-admin") {
      records = records.filter(r => r.orgId === req.user.orgId);
    }

    // Role-based filtering
    if (req.user.role === "manager" && req.user.department) {
      records = records.filter(r => r.department === req.user.department);
    } else if (req.user.role === "viewer") {
      records = records.filter(r => r.assignedTo === req.user.name);
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
    const data = doc.data();
    if (req.user.role !== "super-admin" && data.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    res.json({ success: true, data: { id: doc.id, ...data } });
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

    // Manager can only schedule maintenance for assets in their department
    const assetData = assetDoc.data();

    if (req.user.role !== "super-admin" && assetData.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (req.user.role !== "admin" && req.user.department && assetData.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only schedule maintenance for assets in your department" });
    }

    const record = {
      orgId: assetData.orgId,
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

    // Notify manager and assigned user
    const assetDept = assetData.department || "General";
    await createNotification({
      type: "maintenance",
      title: "Maintenance Scheduled",
      message: record.type + " maintenance scheduled for " + assetData.name + " on " + scheduledDate,
      department: assetDept,
      orgId: assetData.orgId,
      assetId,
      assetName: assetData.name,
      triggeredBy: req.user.name || "Admin"
    });
    if (assignedTo) {
      // Find user by name and notify them
      const userSnap = await db.collection("users").where("name", "==", assignedTo).get();
      if (!userSnap.empty) {
        const assignedUser = userSnap.docs[0].data();
        await createNotification({
          type: "maintenance",
          title: "Asset Maintenance Scheduled",
          message: "Maintenance scheduled for your asset: " + assetData.name + " on " + scheduledDate,
          department: assetDept,
          orgId: assetData.orgId,
          assetId,
          assetName: assetData.name,
          triggeredBy: req.user.name || "Admin",
          targetUserId: userSnap.docs[0].id
        });
        // Email the assigned user
        if (assignedUser.email) {
          await sendEmail({
            to: assignedUser.email,
            subject: "🔧 Maintenance Scheduled: " + assetData.name,
            html: "<div style='font-family:sans-serif;padding:24px'><h2 style='color:#f59e0b'>Taifa — Maintenance Scheduled</h2><p>Hi " + assignedTo + ",</p><p>Maintenance has been scheduled for an asset assigned to you.</p><div style='background:#fef9c3;padding:16px;border-radius:8px;margin:16px 0'><p><strong>Asset:</strong> " + assetData.name + "</p><p><strong>Type:</strong> " + record.type + "</p><p><strong>Date:</strong> " + scheduledDate + "</p><p><strong>Description:</strong> " + (record.description || 'N/A') + "</p></div></div>"
          });
        }
      }
    }

    // Audit log
    await db.collection("asset_audit").add({
      assetId,
      action: "maintenance_scheduled",
      changedBy: req.user.userId || "system",
      orgId: assetData.orgId,
      reason: record.type + " maintenance scheduled",
      oldData: null,
      newData: { ...record, id: docRef.id },
      timestamp: admin.firestore.Timestamp.now()
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

    if (req.user.role !== "super-admin" && doc.data().orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now()
    };
    delete updateData.orgId;

    if (req.body.scheduledDate) {
      updateData.scheduledDate = admin.firestore.Timestamp.fromDate(new Date(req.body.scheduledDate));
    }

    if (req.body.status === "completed") {
      updateData.completedDate = admin.firestore.Timestamp.now();
      // Only restore asset to active if no other active maintenance records exist
      const otherMaintenance = await db.collection("maintenance")
        .where("assetId", "==", doc.data().assetId)
        .get();
      const hasOtherActive = otherMaintenance.docs.some(d =>
        d.id !== req.params.id &&
        ["scheduled", "in-progress"].includes(d.data().status)
      );
      if (!hasOtherActive) {
        await db.collection("assets").doc(doc.data().assetId).update({
          status: "active",
          updatedAt: admin.firestore.Timestamp.now()
        });
      }
    }

    await docRef.update(updateData);

    // Audit log
    await db.collection("asset_audit").add({
      assetId: doc.data().assetId,
      action: updateData.status === "completed" ? "maintenance_completed" : "maintenance_updated",
      changedBy: req.user.userId || "system",
      orgId: doc.data().orgId,
      reason: updateData.status ? "Status changed to " + updateData.status : "Maintenance record updated",
      oldData: doc.data(),
      newData: updateData,
      timestamp: admin.firestore.Timestamp.now()
    });

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

    if (req.user.role !== "super-admin" && doc.data().orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    // Restore asset to active if it was in maintenance
    const assetDoc = await db.collection("assets").doc(doc.data().assetId).get();
    if (assetDoc.exists && assetDoc.data().status === "maintenance") {
      await db.collection("assets").doc(doc.data().assetId).update({
        status: "active",
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    await db.collection("maintenance").doc(req.params.id).delete();

    // Audit log
    await db.collection("asset_audit").add({
      assetId: doc.data().assetId,
      action: "maintenance_deleted",
      changedBy: req.user.userId || "system",
      orgId: doc.data().orgId,
      reason: "Maintenance record deleted",
      oldData: doc.data(),
      newData: null,
      timestamp: admin.firestore.Timestamp.now()
    });

    res.json({ success: true, message: "Maintenance record deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
