const { db, admin } = require("../config/firebase");
const generateAssetCode = require("../services/assetCodeGenerator");

exports.getAssets = async (req, res) => {
  try {
    let query = db.collection("assets");

    if (req.query.includeDeleted !== "true") {
      query = query.where("status", "!=", "deleted");
    }

    // Role-based filtering
    if (req.user && req.user.role === "manager" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    } else if (req.user && req.user.role === "viewer") {
      query = query.where("assignedTo", "==", req.user.name);
    }

    if (req.query.ward) query = query.where("ward", "==", req.query.ward);
    if (req.query.status) query = query.where("status", "==", req.query.status);

    const snapshot = await query.get();
    const assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }));

    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("assets").doc(id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const data = doc.data();
    // Non-admin can only view their department
    if (req.user.role !== "admin" && req.user.department && data.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    res.status(200).json({ success: true, assetId: doc.id, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAsset = async (req, res) => {
  try {
    const { type, name, ward, department } = req.body;
    if (!type || !name || !ward || !department) {
      return res.status(400).json({ success: false, message: "type, name, ward and department are required" });
    }

    // Non-admin managers can only create in their department
    if (req.user.role !== "admin" && req.user.department && department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only create assets in your department" });
    }

    const assetData = {
      assetCode: generateAssetCode(req.body.ward),
      type, name, ward, department,
      assignedTo: req.body.assignedTo || null,
      status: "active",
      value: req.body.value || 0,
      location: req.body.location || null,
      photos: req.body.photos || [],
      acquisitionDate: req.body.acquisitionDate
        ? admin.firestore.Timestamp.fromDate(new Date(req.body.acquisitionDate))
        : admin.firestore.Timestamp.now(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection("assets").add(assetData);
    await db.collection("asset_audit").add({
      assetId: docRef.id, action: "created",
      changedBy: req.user.userId || "system",
      oldData: null, newData: assetData,
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(201).json({ success: true, assetId: docRef.id, assetCode: assetData.assetCode, message: "Asset created successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("assets").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const oldData = doc.data();
    if (req.user.role !== "admin" && req.user.department && oldData.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updateData = { ...req.body, updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "updated",
      changedBy: req.user.userId || "system",
      oldData, newData: updateData,
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Asset updated successfully", assetId: id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.transferAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const { ward, department, transferredBy, reason } = req.body;
    const docRef = db.collection("assets").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const oldData = doc.data();

    // Manager can only transfer assets from their own department
    if (req.user.role !== "admin" && req.user.department && oldData.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only transfer assets in your department" });
    }
    const updateData = { ward: ward || oldData.ward, department: department || oldData.department, updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "transfer",
      changedBy: transferredBy || req.user.userId || "system",
      reason: reason || "not specified",
      oldData, newData: { ...oldData, ...updateData },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Asset transferred successfully", assetId: id, from: { ward: oldData.ward, department: oldData.department }, to: { ward: updateData.ward, department: updateData.department } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAssetHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection("asset_audit").where("assetId", "==", id).get();
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    history.sort((a, b) => b.timestamp?._seconds - a.timestamp?._seconds);
    res.status(200).json({ success: true, assetId: id, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("assets").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const oldData = doc.data();
    const updateData = { status: "deleted", deletedAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "deleted",
      changedBy: req.user.userId || "system",
      reason: req.body.reason || "soft delete",
      oldData, newData: { ...oldData, ...updateData },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Asset deleted successfully", assetId: id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.restoreAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection("assets").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Asset not found" });

    const oldData = doc.data();
    if (oldData.status !== "deleted") return res.status(400).json({ success: false, message: "Asset is not deleted" });

    const updateData = { status: "active", deletedAt: null, updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "restored",
      changedBy: req.user.userId || "system",
      oldData, newData: { ...oldData, ...updateData },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(200).json({ success: true, message: "Asset restored successfully", assetId: id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getWardAnalytics = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role !== "admin" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    }
    const snapshot = await query.get();
    const wards = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const ward = data.ward || "Unknown";
      if (!wards[ward]) wards[ward] = { ward, total: 0, active: 0, deleted: 0, totalValue: 0 };
      wards[ward].total += 1;
      wards[ward].totalValue += data.value || 0;
      if (data.status === "deleted") wards[ward].deleted += 1;
      else wards[ward].active += 1;
    });
    res.status(200).json({ success: true, data: Object.values(wards) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepartmentAnalytics = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role !== "admin" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    }
    const snapshot = await query.get();
    const departments = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const department = data.department || "Unknown";
      if (!departments[department]) departments[department] = { department, total: 0, active: 0, deleted: 0, totalValue: 0 };
      departments[department].total += 1;
      departments[department].totalValue += data.value || 0;
      if (data.status === "deleted") departments[department].deleted += 1;
      else departments[department].active += 1;
    });
    res.status(200).json({ success: true, data: Object.values(departments) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTopAssetsByValue = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    let query = db.collection("assets").where("status", "!=", "deleted");
    if (req.user.role !== "admin" && req.user.department) {
      query = db.collection("assets").where("department", "==", req.user.department);
    }
    const snapshot = await query.get();
    const assets = snapshot.docs.map(doc => ({ assetId: doc.id, ...doc.data() }))
      .filter(a => a.status !== "deleted")
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, limit);
    res.status(200).json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMonthlyAcquisitions = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role !== "admin" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    }
    const snapshot = await query.get();
    const monthly = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.createdAt) return;
      const month = data.createdAt.toDate().toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { month, count: 0, totalValue: 0 };
      monthly[month].count += 1;
      monthly[month].totalValue += data.value || 0;
    });
    const result = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepartmentMonthlyTrends = async (req, res) => {
  try {
    let query = db.collection("assets");
    if (req.user.role !== "admin" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    }
    const snapshot = await query.get();
    const trend = {};
    const departmentsSet = new Set();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.createdAt) return;
      const month = data.createdAt.toDate().toISOString().slice(0, 7);
      const dept = data.department || "Unknown";
      departmentsSet.add(dept);
      if (!trend[month]) trend[month] = {};
      if (!trend[month][dept]) trend[month][dept] = { count: 0, value: 0 };
      trend[month][dept].count += 1;
      trend[month][dept].value += data.value || 0;
    });
    const departments = Array.from(departmentsSet);
    const result = Object.keys(trend).sort().map(month => {
      const row = { month };
      departments.forEach(dept => { row[dept] = trend[month][dept] ? trend[month][dept].count : 0; });
      return row;
    });
    res.status(200).json({ success: true, departments, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
