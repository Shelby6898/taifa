const { db } = require("../config/firebase");

// Full summary report
exports.getSummaryReport = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role === "manager" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    } else if (req.user.role === "viewer") {
      query = query.where("assignedTo", "==", req.user.name);
    }
    const snapshot = await query.get();
    const assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }));

    const total = assets.length;
    const active = assets.filter(a => a.status === "active").length;
    const deleted = assets.filter(a => a.status === "deleted").length;
    const maintenance = assets.filter(a => a.status === "maintenance").length;
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
        summary: { total, active, deleted, maintenance, totalValue },
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
      
      .limit(100)
      .get();

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
        changedBy: userCache[userId] || data.changedBy || 'system',
        timestamp: data.timestamp?.toDate().toISOString()
      };
    }));

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
    res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
