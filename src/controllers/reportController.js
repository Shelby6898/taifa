const { db } = require("../config/firebase");
const cache = require("../utils/cache");

const SUMMARY_CACHE_TTL_MS = 60 * 1000; // 60 seconds - short, since many controllers write to assets

// Full summary report
exports.getSummaryReport = async (req, res) => {
  try {
    const cacheKey = `summary:${req.user.orgId || "super-admin"}:${req.user.role}:${req.user.department || "-"}:${req.user.name || "-"}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    let query = db.collection("assets");
    if (req.user.role === "manager" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    } else if (req.user.role === "viewer") {
      query = query.where("custodian", "==", req.user.name);
    }
    const snapshot = await query.get();
    let assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }));

    if (req.user.role !== "super-admin") {
      assets = assets.filter(a => a.orgId === req.user.orgId);
    }

    const total = assets.length;
    const assigned = assets.filter(a => a.status === "ASSIGNED").length;
    const unassigned = assets.filter(a => a.status === "UNASSIGNED").length;
    const newAssets = assets.filter(a => a.status === "NEW").length;
    const disposed = assets.filter(a => a.status === "DISPOSED").length;
    const maintenance = assets.filter(a => a.status === "MAINTENANCE").length;
    const checkedOut = assets.filter(a => a.checkedOut === true).length;
    const flaggedMissing = assets.filter(a => a.flaggedMissing === true).length;
    const totalCurrentValue = assets.reduce((sum, a) => sum + (a.currentValue || a.value || 0), 0);
    const totalValue = assets.reduce((sum, a) => sum + (a.value || 0), 0);

    // by ward
    const byWard = {};
    assets.forEach(a => {
      const w = a.ward || "Unknown";
      if (!byWard[w]) byWard[w] = { ward: w, count: 0, totalValue: 0 };
      byWard[w].count++;
      byWard[w].totalValue += a.value || 0;
    });

    // by department
    const byDept = {};
    assets.forEach(a => {
      const d = a.department || "Unknown";
      if (!byDept[d]) byDept[d] = { department: d, count: 0, totalValue: 0 };
      byDept[d].count++;
      byDept[d].totalValue += a.value || 0;
    });

    // by type
    const byType = {};
    assets.forEach(a => {
      const t = a.type || "Unknown";
      if (!byType[t]) byType[t] = { type: t, count: 0, totalValue: 0 };
      byType[t].count++;
      byType[t].totalValue += a.value || 0;
    });

    const responsePayload = {
      success: true,
      data: {
        summary: { total, assigned, unassigned, newAssets, maintenance, disposed, checkedOut, flaggedMissing, totalValue, totalCurrentValue },
        byWard: Object.values(byWard),
        byDepartment: Object.values(byDept),
        byType: Object.values(byType)
      }
    };

    cache.set(cacheKey, responsePayload, SUMMARY_CACHE_TTL_MS);
    res.status(200).json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Audit log report
exports.getAuditReport = async (req, res) => {
  try {
    const snapshot = await db.collection("asset_audit")
      
      .limit(100)
      .get();

    const userCache = {};
    let logs = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const userId = data.changedBy;
      if (userId && userId !== 'system' && !userCache[userId]) {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          userCache[userId] = userDoc.exists ? userDoc.data().name : userId;
        } catch(e) { userCache[userId] = userId; }
      }
      return {
        id: doc.id,
        ...data,
        changedBy: userCache[userId] || data.changedBy || 'system',
        timestamp: data.timestamp?.toDate().toISOString()
      };
    }));

    // Organization isolation
    if (req.user.role !== "super-admin") {
      logs = logs.filter(l => l.orgId === req.user.orgId);
    }

    // Managers only see their department's audit logs
    if (req.user.role === 'manager' && req.user.department) {
      // Get asset IDs in their department
      const assetsSnap = await db.collection('assets').where('department', '==', req.user.department).get();
      const deptAssetIds = new Set(assetsSnap.docs.map(d => d.id));
      logs = logs.filter(l => deptAssetIds.has(l.assetId));
    }

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Ticket audit log
exports.getTicketAuditReport = async (req, res) => {
  try {
    const snapshot = await db.collection('ticket_audit').limit(100).get();
    const userCache = {};
    const logs = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const userId = data.changedBy;
      if (userId && !userCache[userId]) {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          userCache[userId] = userDoc.exists ? userDoc.data().name : userId;
        } catch(e) { userCache[userId] = userId; }
      }
      return {
        id: doc.id,
        ...data,
        changedByName: userCache[userId] || data.changedByName || 'system',
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
      };
    }));

    const scopedLogs = req.user.role === "super-admin" ? logs : logs.filter(l => l.orgId === req.user.orgId);
    res.status(200).json({ success: true, count: scopedLogs.length, data: scopedLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// User audit log
exports.getUserAuditReport = async (req, res) => {
  try {
    const snapshot = await db.collection('user_audit').limit(100).get();
    const userCache = {};
    const logs = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();
      const userId = data.changedBy;
      if (userId && userId !== 'system' && !userCache[userId]) {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          userCache[userId] = userDoc.exists ? userDoc.data().name : userId;
        } catch(e) { userCache[userId] = userId; }
      }
      return {
        id: doc.id,
        ...data,
        changedByName: userCache[userId] || data.changedByName || 'system',
        timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null
      };
    }));

    const scopedLogs = req.user.role === "super-admin" ? logs : logs.filter(l => l.orgId === req.user.orgId);
    res.status(200).json({ success: true, count: scopedLogs.length, data: scopedLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
