const { db, admin } = require("../config/firebase");

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const DOCUMENT_CATEGORIES = [
  "ACQUISITION",
  "DISPOSAL",
  "VALUATION",
  "OWNERSHIP_CHANGE",
  "MAINTENANCE",
  "INSURANCE",
  "WARRANTY",
  "OTHER"
];

// Upload a document attached to an asset
exports.uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { fileName, fileType, fileData, category, description } = req.body;

    if (!fileName || !fileType || !fileData || !category) {
      return res.status(400).json({ success: false, message: "fileName, fileType, fileData and category are required" });
    }

    if (!ALLOWED_TYPES.includes(fileType)) {
      return res.status(400).json({ success: false, message: "File type not allowed. Allowed: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX" });
    }

    if (!DOCUMENT_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${DOCUMENT_CATEGORIES.join(", ")}` });
    }

    // Size check — base64 is ~1.33x the original file size
    // Cap at 2MB original file = ~2.7MB base64
    if (fileData.length > 2700000) {
      return res.status(400).json({ success: false, message: "File too large. Maximum size is 2MB." });
    }

    // Verify asset exists and belongs to org
    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const now = admin.firestore.Timestamp.now();

    const docRef = await db.collection("asset_documents").add({
      assetId: id,
      orgId: asset.orgId,
      fileName,
      fileType,
      fileData,
      category,
      description: description || null,
      uploadedBy: req.user.userId || "system",
      uploadedByName: req.user.name || "System",
      createdAt: now
    });

    // Audit log
    await db.collection("asset_audit").add({
      assetId: id,
      action: "document_uploaded",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Document uploaded: ${fileName} (${category})`,
      oldData: null,
      newData: { fileName, fileType, category },
      timestamp: now
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      documentId: docRef.id,
      fileName,
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all documents for an asset
exports.getAssetDocuments = async (req, res) => {
  try {
    const { id } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const snapshot = await db.collection("asset_documents")
      .where("assetId", "==", id)
      .get();

    // Return metadata only — not fileData (to keep response small)
    const docs = snapshot.docs
      .map(doc => ({
        id: doc.id,
        assetId: doc.data().assetId,
        fileName: doc.data().fileName,
        fileType: doc.data().fileType,
        category: doc.data().category,
        description: doc.data().description,
        uploadedByName: doc.data().uploadedByName,
        createdAt: doc.data().createdAt
      }))
      .sort((a, b) => b.createdAt?._seconds - a.createdAt?._seconds);

    res.status(200).json({ success: true, assetId: id, count: docs.length, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Download a specific document (returns fileData)
exports.downloadDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const docSnap = await db.collection("asset_documents").doc(docId).get();
    if (!docSnap.exists) return res.status(404).json({ success: false, message: "Document not found" });

    const docData = docSnap.data();
    if (docData.assetId !== id) return res.status(404).json({ success: false, message: "Document not found" });

    res.status(200).json({
      success: true,
      data: {
        id: docSnap.id,
        fileName: docData.fileName,
        fileType: docData.fileType,
        fileData: docData.fileData,
        category: docData.category,
        description: docData.description,
        uploadedByName: docData.uploadedByName,
        createdAt: docData.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const docSnap = await db.collection("asset_documents").doc(docId).get();
    if (!docSnap.exists) return res.status(404).json({ success: false, message: "Document not found" });

    if (docSnap.data().assetId !== id) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    await db.collection("asset_documents").doc(docId).delete();

    await db.collection("asset_audit").add({
      assetId: id,
      action: "document_deleted",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Document deleted: ${docSnap.data().fileName}`,
      oldData: { fileName: docSnap.data().fileName, category: docSnap.data().category },
      newData: null,
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get document categories
exports.getDocumentCategories = async (req, res) => {
  res.status(200).json({ success: true, data: DOCUMENT_CATEGORIES });
};
