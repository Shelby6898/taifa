const { db, admin } = require("../config/firebase");

const DISPOSAL_METHODS = [
  "TRANSFER",
  "LEASING",
  "TRANSFER_TO_OTHER_AUTHORITY",
  "SALE_BY_TENDER",
  "SALE_BY_PUBLIC_AUCTION",
  "TRADE_IN",
  "BURNING",
  "DESTRUCTION",
  "CANCELLATION"
];

// Dispose an asset — terminal action
exports.disposeAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, reason, proceedsAmount, approvedBy, notes } = req.body;

    if (!method || !reason) {
      return res.status(400).json({ success: false, message: "method and reason are required" });
    }

    if (!DISPOSAL_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `method must be one of: ${DISPOSAL_METHODS.join(", ")}`
      });
    }

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

    // Close any open custody record
    const openCustody = await db.collection("asset_custody_logs")
      .where("assetId", "==", id)
      .where("endDate", "==", null)
      .get();

    const batch = db.batch();
    openCustody.docs.forEach(doc => {
      batch.update(doc.ref, { endDate: now });
    });

    // Write disposal record
    const disposalRef = db.collection("asset_disposals").doc();
    batch.set(disposalRef, {
      assetId: id,
      assetCode: asset.assetCode || null,
      assetName: asset.name,
      orgId: asset.orgId,
      method,
      reason,
      notes: notes || null,
      proceedsAmount: proceedsAmount ? Number(proceedsAmount) : 0,
      approvedBy: approvedBy || null,
      disposedBy: req.user.userId || "system",
      disposedByName: req.user.name || "System",
      previousStatus: asset.status,
      valueAtDisposal: asset.currentValue || asset.value || 0,
      disposedAt: now,
      createdAt: now
    });

    // Update asset to DISPOSED — terminal
    batch.update(assetRef, {
      status: "DISPOSED",
      previousStatus: asset.status,
      custodian: null,
      custodianId: null,
      disposedAt: now,
      disposalMethod: method,
      disposalReason: reason,
      updatedAt: now
    });

    await batch.commit();

    // Audit log
    await db.collection("asset_audit").add({
      assetId: id,
      action: "disposed",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Asset disposed via ${method}: ${reason}`,
      oldData: { status: asset.status, custodian: asset.custodian || null },
      newData: { status: "DISPOSED", method, reason },
      timestamp: now
    });

    res.status(200).json({
      success: true,
      message: `Asset "${asset.name}" has been disposed`,
      disposalId: disposalRef.id,
      method,
      valueAtDisposal: asset.currentValue || asset.value || 0,
      proceedsAmount: proceedsAmount ? Number(proceedsAmount) : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get disposal record for an asset
exports.getAssetDisposal = async (req, res) => {
  try {
    const { id } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const snapshot = await db.collection("asset_disposals")
      .where("assetId", "==", id)
      .get();

    const disposals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, assetId: id, data: disposals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all disposals for the org
exports.getOrgDisposals = async (req, res) => {
  try {
    const snapshot = await db.collection("asset_disposals")
      .where("orgId", "==", req.user.orgId)
      .get();

    const disposals = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.disposedAt?._seconds - a.disposedAt?._seconds);

    const summary = {
      total: disposals.length,
      totalValueDisposed: disposals.reduce((s, d) => s + (d.valueAtDisposal || 0), 0),
      totalProceeds: disposals.reduce((s, d) => s + (d.proceedsAmount || 0), 0),
      byMethod: DISPOSAL_METHODS.reduce((acc, m) => {
        acc[m] = disposals.filter(d => d.method === m).length;
        return acc;
      }, {})
    };

    res.status(200).json({ success: true, count: disposals.length, summary, data: disposals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get available disposal methods
exports.getDisposalMethods = async (req, res) => {
  res.status(200).json({ success: true, data: DISPOSAL_METHODS });
};
