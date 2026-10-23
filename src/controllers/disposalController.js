const { db, admin } = require("../config/firebase");
const cache = require("../utils/cache");

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
    // Only organization admins may dispose of assets.
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only an organization admin can dispose of assets"
      });
    }
    const { id } = req.params;
    const { method, reason, proceedsAmount, approvedBy, notes } = req.body;

    if (!method || !reason) {
      return res.status(400).json({
        success: false,
        message: "method and reason are required"
      });
    }

    if (!DISPOSAL_METHODS.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `method must be one of: ${DISPOSAL_METHODS.join(", ")}`
      });
    }

    // Validate proceeds before starting the Firestore transaction.
    let proceeds = 0;

    if (
      proceedsAmount !== undefined &&
      proceedsAmount !== null &&
      proceedsAmount !== ""
    ) {
      if (
        (typeof proceedsAmount !== "number" &&
          typeof proceedsAmount !== "string") ||
        (typeof proceedsAmount === "string" &&
          proceedsAmount.trim() === "")
      ) {
        return res.status(400).json({
          success: false,
          message: "proceedsAmount must be a finite, non-negative number"
        });
      }

      proceeds = Number(proceedsAmount);

      if (!Number.isFinite(proceeds) || proceeds < 0) {
        return res.status(400).json({
          success: false,
          message: "proceedsAmount must be a finite, non-negative number"
        });
      }
    }

    const assetRef = db.collection("assets").doc(id);
    const disposalRef = db.collection("asset_disposals").doc();
    const auditRef = db.collection("asset_audit").doc();
    const now = admin.firestore.Timestamp.now();

    const result = await db.runTransaction(async (transaction) => {
      // All reads must happen before any transaction writes.
      const assetDoc = await transaction.get(assetRef);

      if (!assetDoc.exists) {
        return { error: "not-found" };
      }

      const asset = assetDoc.data();

      if (asset.orgId !== req.user.orgId) {
        return { error: "not-found" };
      }

      if (asset.status === "DISPOSED") {
        return { error: "already-disposed" };
      }

      const custodyQuery = db.collection("asset_custody_logs")
        .where("assetId", "==", id)
        .where("orgId", "==", asset.orgId)
        .where("endDate", "==", null);

      const openCustody = await transaction.get(custodyQuery);

      // All writes, including the audit event, commit atomically.
      openCustody.docs.forEach((custodyDoc) => {
        const custody = custodyDoc.data();
        if (!custody || custody.orgId !== asset.orgId) return;

        transaction.update(custodyDoc.ref, { endDate: now });
      });

      const valueAtDisposal = asset.currentValue || asset.value || 0;

      transaction.set(disposalRef, {
        assetId: id,
        assetCode: asset.assetCode || null,
        assetName: asset.name,
        orgId: asset.orgId,
        method,
        reason,
        notes: notes || null,
        proceedsAmount: proceeds,
        approvedBy: approvedBy || null,
        disposedBy: req.user.userId || "system",
        disposedByName: req.user.name || "System",
        previousStatus: asset.status,
        valueAtDisposal,
        disposedAt: now,
        createdAt: now
      });

      transaction.update(assetRef, {
        status: "DISPOSED",
        previousStatus: asset.status,
        custodian: null,
        custodianId: null,
        disposedAt: now,
        disposalMethod: method,
        disposalReason: reason,
        updatedAt: now
      });

      transaction.set(auditRef, {
        assetId: id,
        action: "disposed",
        changedBy: req.user.userId || "system",
        orgId: asset.orgId,
        message: `Asset disposed via ${method}: ${reason}`,
        oldData: {
          status: asset.status,
          custodian: asset.custodian || null
        },
        newData: {
          status: "DISPOSED",
          method,
          reason
        },
        timestamp: now
      });

      return {
        assetName: asset.name,
        valueAtDisposal,
        proceedsAmount: proceeds,
        orgId: asset.orgId
      };
    });

    if (result.error === "not-found") {
      return res.status(404).json({
        success: false,
        message: "Asset not found"
      });
    }

    if (result.error === "already-disposed") {
      return res.status(400).json({
        success: false,
        message: "Asset is already disposed"
      });
    }

    // Invalidate summaries only after the disposal transaction succeeds.
    cache.delPrefix(`summary:${result.orgId}`);
    cache.delPrefix("summary:super-admin");

    return res.status(200).json({
      success: true,
      message: `Asset "${result.assetName}" has been disposed`,
      disposalId: disposalRef.id,
      method,
      valueAtDisposal: result.valueAtDisposal,
      proceedsAmount: result.proceedsAmount
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
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

    const disposalsRef = db.collection("asset_disposals");
    let query = disposalsRef.where("assetId", "==", id);

    if (req.user.role !== "super-admin") {
      query = query.where("orgId", "==", req.user.orgId);
    }

    const snapshot = await query.get();

    const disposals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, assetId: id, data: disposals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all disposals for the org
exports.getOrgDisposals = async (req, res) => {
  try {
    const disposalsRef = db.collection("asset_disposals");
    const snapshot = req.user.role === "super-admin"
      ? await disposalsRef.get()
      : await disposalsRef
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
