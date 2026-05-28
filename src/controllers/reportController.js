const { db } = require("../config/firebase");

// Full summary report
exports.getSummaryReport = async (req, res) => {
  try {
    const snapshot = await db.collection("assets").get();
    const assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }));

    const total = assets.length;
    const active = assets.filter(a => a.status === "active").length;
    const deleted = assets.filter(a => a.status === "deleted").length;
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

    res.status(200).json({
      success: true,
      data: {
        summary: { total, active, deleted, totalValue },
        byWard: Object.values(byWard),
        byDepartment: Object.values(byDept),
        byType: Object.values(byType)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Audit log report
exports.getAuditReport = async (req, res) => {
  try {
    const snapshot = await db.collection("asset_audit")
      .orderBy("timestamp", "desc")
      .limit(100)
      .get();

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate().toISOString()
      };
    });

    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
