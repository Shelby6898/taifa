const { db, admin } = require("../config/firebase");

// GET notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const snapshot = await db.collection("notifications").get();
    let notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString()
    }));

    // Role-based filtering
    if (req.user.role === "admin") {
      // admin sees all
    } else if (req.user.role === "manager") {
      notifications = notifications.filter(n =>
        n.department === req.user.department ||
        n.targetUserId === req.user.userId ||
        n.department === "all"
      );
    } else {
      // viewer sees only their own
      notifications = notifications.filter(n =>
        n.targetUserId === req.user.userId ||
        n.department === "all"
      );
    }

    // Sort newest first
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Mark which ones current user has read
    const userId = req.user.userId;
    notifications = notifications.map(n => ({
      ...n,
      isRead: (n.readBy || []).includes(userId)
    }));

    res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MARK notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const docRef = db.collection("notifications").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Notification not found" });

    const readBy = doc.data().readBy || [];
    if (!readBy.includes(userId)) {
      await docRef.update({ readBy: [...readBy, userId] });
    }

    res.json({ success: true, message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// MARK all as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const snapshot = await db.collection("notifications").get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      const readBy = doc.data().readBy || [];
      if (!readBy.includes(userId)) {
        batch.update(doc.ref, { readBy: [...readBy, userId] });
      }
    });
    await batch.commit();

    res.json({ success: true, message: "All marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE notification (admin only)
exports.deleteNotification = async (req, res) => {
  try {
    await db.collection("notifications").doc(req.params.id).delete();
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CREATE notification (internal helper - also exported for use in other controllers)
exports.createNotification = async ({ type, title, message, department, assetId, assetName, fromDept, toDept, triggeredBy, targetUserId, targetRole }) => {
  try {
    await db.collection("notifications").add({
      type,
      title,
      message,
      department: department || "all",
      assetId: assetId || null,
      assetName: assetName || null,
      fromDept: fromDept || null,
      toDept: toDept || null,
      triggeredBy: triggeredBy || "system",
      targetUserId: targetUserId || null,
      targetRole: targetRole || null,
      readBy: [],
      createdAt: admin.firestore.Timestamp.now()
    });
  } catch (error) {
    console.error("Failed to create notification:", error.message);
  }
};
