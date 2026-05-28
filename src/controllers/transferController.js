const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");

exports.getTransfers = async (req, res) => {
  try {
    const snapshot = await db.collection("asset_audit")
      .where("action", "==", "transfer")
      .get();

    const transfers = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        const assetDoc = await db.collection("assets").doc(data.assetId).get();
        const assetName = assetDoc.exists ? assetDoc.data().name : "Unknown";
        return {
          id: doc.id,
          assetName,
          ...data,
          timestamp: data.timestamp?.toDate().toISOString()
        };
      })
    );

    transfers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.status(200).json({ success: true, count: transfers.length, data: transfers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTransfer = async (req, res) => {
  try {
    const { assetId, ward, department, transferredBy, reason } = req.body;

    if (!assetId || !ward || !department) {
      return res.status(400).json({ success: false, message: "assetId, ward and department are required" });
    }

    const docRef = db.collection("assets").doc(assetId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const oldData = doc.data();
    const updateData = { ward, department, updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);

    await db.collection("asset_audit").add({
      assetId,
      action: "transfer",
      changedBy: transferredBy || req.user?.userId || "system",
      reason: reason || "not specified",
      oldData,
      newData: { ...oldData, ...updateData },
      timestamp: admin.firestore.Timestamp.now()
    });

    // 🔔 Notify both departments
    const assetName = oldData.name;
    const fromDept = oldData.department;
    const toDept = department;
    const by = transferredBy || req.user?.name || "Admin";

    // Notify source department — asset leaving
    if (fromDept && fromDept !== toDept) {
      await createNotification({
        type: "transfer_out",
        title: "Asset Transferred Out",
        message: `${assetName} has been transferred from ${fromDept} to ${toDept} by ${by}. Reason: ${reason || "not specified"}`,
        department: fromDept,
        assetId,
        assetName,
        fromDept,
        toDept,
        triggeredBy: by
      });

      // Notify destination department — asset arriving
      await createNotification({
        type: "transfer_in",
        title: "Asset Transferred In",
        message: `${assetName} has been transferred to ${toDept} from ${fromDept} by ${by}. Reason: ${reason || "not specified"}`,
        department: toDept,
        assetId,
        assetName,
        fromDept,
        toDept,
        triggeredBy: by
      });
    }

    // Notify admin always
    await createNotification({
      type: "transfer",
      title: "Asset Transfer",
      message: `${assetName} transferred from ${fromDept} (${oldData.ward}) to ${toDept} (${ward}) by ${by}`,
      department: "all",
      assetId,
      assetName,
      fromDept,
      toDept,
      triggeredBy: by
    });

    res.status(200).json({
      success: true,
      message: "Asset transferred successfully",
      from: { ward: oldData.ward, department: oldData.department },
      to: { ward, department }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
