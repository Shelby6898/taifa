const { db, admin } = require("../config/firebase");
const generateAssetCode = require("../services/assetCodeGenerator");

// IFMIS pushes a procurement record to Taifatech after purchase is complete
exports.ifmisIntake = async (req, res) => {
  try {
    // Validate IFMIS secret so only authorized systems can post
    const secret = req.headers["x-ifmis-secret"];
    if (!secret || secret !== process.env.IFMIS_SECRET) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      orgId,
      name,
      type,
      categoryId,
      ward,
      department,
      value,
      purchaseOrderNumber,
      supplierName,
      invoiceNumber,
      acquisitionDate,
      serialNumber,
      location,
      notes
    } = req.body;

    // Required fields
    if (!orgId || !name || !type || !ward || !department || !value) {
      return res.status(400).json({
        success: false,
        message: "orgId, name, type, ward, department and value are required"
      });
    }

    // Verify org exists
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    if (!orgDoc.exists) {
      return res.status(404).json({ success: false, message: "Organisation not found" });
    }

    // Validate category if provided
    let categoryData = null;
    if (categoryId) {
      const catDoc = await db.collection("asset_categories").doc(categoryId).get();
      if (!catDoc.exists) {
        return res.status(404).json({ success: false, message: "Category not found" });
      }
      categoryData = catDoc.data();
      if (categoryData.orgId !== orgId) {
        return res.status(400).json({ success: false, message: "Category does not belong to this organisation" });
      }
    }

    const now = admin.firestore.Timestamp.now();
    const acquiredAt = acquisitionDate
      ? admin.firestore.Timestamp.fromDate(new Date(acquisitionDate))
      : now;

    const assetData = {
      orgId,
      assetCode: generateAssetCode(ward),
      name: name.trim(),
      type: type.trim(),
      categoryId: categoryId || null,
      appreciationRate: categoryData?.appreciationRate || null,
      appreciationType: categoryData?.appreciationType || null,
      ward: ward.trim(),
      department: department.trim(),
      value: Number(value),
      currentValue: Number(value),
      serialNumber: serialNumber || null,
      location: location || null,
      notes: notes || null,
      status: "NEW",
      previousStatus: null,
      statusReason: "Acquired via IFMIS",
      custodian: null,
      custodianId: null,
      // IFMIS procurement fields
      source: "IFMIS",
      purchaseOrderNumber: purchaseOrderNumber || null,
      supplierName: supplierName || null,
      invoiceNumber: invoiceNumber || null,
      acquisitionDate: acquiredAt,
      photos: [],
      createdAt: now,
      updatedAt: now
    };

    const docRef = await db.collection("assets").add(assetData);

    // Audit log
    await db.collection("asset_audit").add({
      assetId: docRef.id,
      action: "ifmis_intake",
      changedBy: "IFMIS",
      orgId,
      message: `Asset acquired via IFMIS — PO: ${purchaseOrderNumber || "N/A"}, Supplier: ${supplierName || "N/A"}`,
      oldData: null,
      newData: assetData,
      timestamp: now
    });

    res.status(201).json({
      success: true,
      message: "Asset received from IFMIS successfully",
      assetId: docRef.id,
      assetCode: assetData.assetCode,
      status: "NEW"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all IFMIS-sourced assets for an org
exports.getIfmisAssets = async (req, res) => {
  try {
    const snapshot = await db.collection("assets")
      .where("orgId", "==", req.user.orgId)
      .where("source", "==", "IFMIS")
      .get();

    const assets = snapshot.docs
      .map(doc => ({ assetId: doc.id, ...doc.data() }))
      .sort((a, b) => b.createdAt?._seconds - a.createdAt?._seconds);

    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
