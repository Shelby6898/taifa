const { db, admin } = require("../config/firebase");

// Manual valuation by a valuator
exports.createValuation = async (req, res) => {
  try {
    const { id } = req.params;
    const { value, valuationReason, appreciationType, notes } = req.body;

    if (!value || !valuationReason || !appreciationType) {
      return res.status(400).json({ success: false, message: "value, valuationReason and appreciationType are required" });
    }

    if (!["APPRECIATION", "DEPRECIATION"].includes(appreciationType)) {
      return res.status(400).json({ success: false, message: "appreciationType must be APPRECIATION or DEPRECIATION" });
    }

    const assetRef = db.collection("assets").doc(id);
    const assetDoc = await assetRef.get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (asset.status === "DISPOSED") {
      return res.status(400).json({ success: false, message: "Cannot valuate a disposed asset" });
    }

    const now = admin.firestore.Timestamp.now();
    const previousValue = asset.currentValue || asset.value || 0;
    const newValue = Number(value);
    const appreciationRate = previousValue > 0
      ? Math.round(((newValue - previousValue) / previousValue) * 100 * 100) / 100
      : 0;

    // Write valuation log
    const logRef = await db.collection("asset_valuation_logs").add({
      assetId: id,
      orgId: asset.orgId,
      previousValue,
      value: newValue,
      appreciationType,
      appreciationRate,
      valuationReason,
      notes: notes || null,
      valuatedBy: req.user.userId || "system",
      valuatedByName: req.user.name || "System",
      valuatedOn: now,
      createdAt: now
    });

    // Update asset current value
    await assetRef.update({
      currentValue: newValue,
      lastValuatedAt: now,
      lastValuatedBy: req.user.name || "System",
      updatedAt: now
    });

    // Audit log
    await db.collection("asset_audit").add({
      assetId: id,
      action: "valuation",
      changedBy: req.user.userId || "system",
      orgId: asset.orgId,
      message: `Asset valued at KES ${newValue.toLocaleString()} (${appreciationType})`,
      oldData: { currentValue: previousValue },
      newData: { currentValue: newValue },
      timestamp: now
    });

    res.status(201).json({
      success: true,
      message: "Valuation recorded successfully",
      valuationId: logRef.id,
      previousValue,
      newValue,
      appreciationRate,
      appreciationType
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get valuation history for an asset
exports.getValuationLog = async (req, res) => {
  try {
    const { id } = req.params;

    const assetDoc = await db.collection("assets").doc(id).get();
    if (!assetDoc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const asset = assetDoc.data();
    if (asset.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const snapshot = await db.collection("asset_valuation_logs")
      .where("assetId", "==", id)
      .get();

    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => b.valuatedOn?._seconds - a.valuatedOn?._seconds);

    res.status(200).json({ success: true, assetId: id, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Daily automated valuation job — called by cron-job.org
exports.runDailyValuation = async (req, res) => {
  try {
    // Validate backup secret so only cron can call this
    const secret = req.headers["x-backup-secret"] || req.query.secret;
    if (secret !== process.env.BACKUP_SECRET) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const snapshot = await db.collection("assets")
      .where("status", "!=", "DISPOSED")
      .get();

    const now = new Date();
    let processed = 0;
    let skipped = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const asset = { assetId: doc.id, ...doc.data() };

      // Get category for rate
      let depreciationRate = 20;
      let appreciationType = "DEPRECIATION";

      if (asset.categoryId) {
        const catDoc = await db.collection("asset_categories").doc(asset.categoryId).get();
        if (catDoc.exists) {
          const cat = catDoc.data();
          depreciationRate = cat.appreciationRate || 20;
          appreciationType = cat.appreciationType || "DEPRECIATION";
        }
      } else {
        // Fallback to hardcoded rates by type
        const RATES = {
          "ICT Equipment": 33.33, "Vehicle": 25, "Furniture": 10,
          "Machinery": 15, "Building": 2.5, "Land": 0, "Other": 20
        };
        depreciationRate = RATES[asset.type] || 20;
      }

      if (depreciationRate === 0) { skipped++; continue; }

      const originalValue = asset.value || 0;
      if (originalValue === 0) { skipped++; continue; }

      // Calculate current value based on age
      let acquisitionDate;
      if (asset.acquisitionDate?._seconds) {
        acquisitionDate = new Date(asset.acquisitionDate._seconds * 1000);
      } else {
        acquisitionDate = new Date(asset.createdAt?._seconds * 1000 || Date.now());
      }

      const ageYears = Math.max(0, (now - acquisitionDate) / (1000 * 60 * 60 * 24 * 365.25));
      const annualChange = (originalValue * depreciationRate) / 100;
      let newValue;

      if (appreciationType === "DEPRECIATION") {
        newValue = Math.max(0, originalValue - annualChange * ageYears);
      } else {
        newValue = originalValue + annualChange * ageYears;
      }

      newValue = Math.round(newValue);
      const previousValue = asset.currentValue || originalValue;

      if (newValue === previousValue) { skipped++; continue; }

      const nowTimestamp = admin.firestore.Timestamp.now();

      // Write valuation log
      const logRef = db.collection("asset_valuation_logs").doc();
      batch.set(logRef, {
        assetId: doc.id,
        orgId: asset.orgId,
        previousValue,
        value: newValue,
        appreciationType,
        appreciationRate: depreciationRate,
        valuationReason: "DAILY_AUTOMATED_JOB",
        notes: null,
        valuatedBy: "system",
        valuatedByName: "System (Daily Job)",
        valuatedOn: nowTimestamp,
        createdAt: nowTimestamp
      });

      // Update asset
      batch.update(doc.ref, {
        currentValue: newValue,
        lastValuatedAt: nowTimestamp,
        lastValuatedBy: "System (Daily Job)",
        updatedAt: nowTimestamp
      });

      processed++;
    }

    await batch.commit();

    res.json({
      success: true,
      message: `Daily valuation complete`,
      processed,
      skipped
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
