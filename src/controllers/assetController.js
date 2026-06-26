const { db, admin } = require("../config/firebase");
const { createNotification } = require("./notificationController");
const generateAssetCode = require("../services/assetCodeGenerator");

function sameOrg(data, req) {
  return req.user.role === "super-admin" || data.orgId === req.user.orgId;
}

exports.getAssets = async (req, res) => {
  try {
    let query = db.collection("assets");

    if (req.query.includeDeleted !== "true") {
      query = query.where("status", "!=", "DISPOSED");
    }

    // Role-based filtering
    if (req.user && req.user.role === "manager" && req.user.department) {
      query = query.where("department", "==", req.user.department);
    } else if (req.user && req.user.role === "viewer") {
      query = query.where("custodian", "==", req.user.name);
    }

    if (req.query.ward) query = query.where("ward", "==", req.query.ward);
    if (req.query.status) query = query.where("status", "==", req.query.status);

    const snapshot = await query.get();
    const assets = snapshot.docs
      .map(doc => ({ assetId: doc.id, ...doc.data() }))
      .filter(a => req.user.role === "super-admin" || a.orgId === req.user.orgId);

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

    if (!sameOrg(data, req)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

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

    // If custodian is set, auto-set department to match that user's department
    let finalDepartment = department;
    let custodian = req.body.custodian || null;
    if (custodian) {
      const userSnap = await db.collection("users").where("name", "==", custodian).get();
      if (!userSnap.empty) {
        const assignedUser = userSnap.docs[0].data();
        if (assignedUser.department) {
          finalDepartment = assignedUser.department;
        }
      }
    }

    const assetData = {
      orgId: req.user.orgId,
      assetCode: generateAssetCode(req.body.ward),
      type, name, ward, department: finalDepartment,
      status: req.body.custodian ? "ASSIGNED" : "UNASSIGNED",
      previousStatus: null,
      statusReason: null,
      custodian: req.body.custodian || null,
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
      orgId: req.user.orgId,
      oldData: null, newData: assetData,
      timestamp: admin.firestore.Timestamp.now()
    });

    await createNotification({
      type: "asset_created",
      title: "New Asset Added",
      message: `Asset "${name}" has been added to ${finalDepartment} department`,
      department: finalDepartment,
      orgId: req.user.orgId,
      assetId: docRef.id,
      assetName: name,
      triggeredBy: req.user.name || "Admin"
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

    if (!sameOrg(oldData, req)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    if (req.user.role !== "admin" && req.user.department && oldData.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const updateData = { ...req.body, updatedAt: admin.firestore.Timestamp.now() };
    delete updateData.orgId;
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "updated",
      changedBy: req.user.userId || "system",
      orgId: oldData.orgId,
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

    if (!sameOrg(oldData, req)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    // Manager can only transfer assets from their own department
    if (req.user.role !== "admin" && req.user.department && oldData.department !== req.user.department) {
      return res.status(403).json({ success: false, message: "You can only transfer assets in your department" });
    }
    const updateData = { ward: ward || oldData.ward, department: department || oldData.department, updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "transfer",
      changedBy: transferredBy || req.user.userId || "system",
      orgId: oldData.orgId,
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
    const history = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(h => req.user.role === "super-admin" || h.orgId === req.user.orgId);
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

    if (!sameOrg(oldData, req)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const updateData = { status: "DISPOSED", disposedAt: admin.firestore.Timestamp.now(), updatedAt: admin.firestore.Timestamp.now() };
    await docRef.update(updateData);
    await db.collection("asset_audit").add({
      assetId: id, action: "deleted",
      changedBy: req.user.userId || "system",
      orgId: oldData.orgId,
      reason: (req.body && req.body.reason) || "soft delete",
      oldData, newData: { ...oldData, ...updateData },
      timestamp: admin.firestore.Timestamp.now()
    });

    await createNotification({
      type: "alert",
      title: "Asset Deleted",
      message: `Asset "${oldData.name}" has been deleted from ${oldData.department} department`,
      department: oldData.department,
      orgId: oldData.orgId,
      assetId: id,
      assetName: oldData.name,
      triggeredBy: req.user.name || "Admin"
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

    if (!sameOrg(oldData, req)) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }
    if (oldData.status === "DISPOSED") return res.status(400).json({ success: false, message: "Asset is already disposed and cannot be restored" });
    const updateData = { status: "UNASSIGNED",
      previousStatus: oldData.status, statusReason: null, updatedAt: admin.firestore.Timestamp.now() };
    await db.collection("asset_audit").add({
      assetId: id, action: "restored",
      changedBy: req.user.userId || "system",
      orgId: oldData.orgId,
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
      if (req.user.role !== "super-admin" && data.orgId !== req.user.orgId) return;
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
      if (req.user.role !== "super-admin" && data.orgId !== req.user.orgId) return;
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
      .filter(a => req.user.role === "super-admin" || a.orgId === req.user.orgId)
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
      if (req.user.role !== "super-admin" && data.orgId !== req.user.orgId) return;
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
      if (req.user.role !== "super-admin" && data.orgId !== req.user.orgId) return;
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

/*
|--------------------------------------------------------------------------
| BULK IMPORT TEMPLATE (Excel)
|--------------------------------------------------------------------------
*/
exports.bulkImportTemplate = async (req, res) => {
  try {
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Assets");

    sheet.columns = [
      { header: "type", key: "type", width: 20 },
      { header: "name", key: "name", width: 30 },
      { header: "ward", key: "ward", width: 20 },
      { header: "department", key: "department", width: 20 },
      { header: "value", key: "value", width: 15 },
      { header: "location", key: "location", width: 25 },
      { header: "custodian", key: "custodian", width: 25 },
      { header: "acquisitionDate", key: "acquisitionDate", width: 18 }
    ];

    sheet.getRow(1).font = { bold: true };

    sheet.addRow({
      type: "Laptop",
      name: "Dell Latitude 5420",
      ward: "Bungoma Central",
      department: "ICT",
      value: 65000,
      location: "ICT Office, Room 4",
      custodian: "",
      acquisitionDate: "2025-01-15"
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=asset_import_template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Template error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| BULK IMPORT ASSETS (Excel)
|--------------------------------------------------------------------------
*/
exports.bulkImportAssets = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];
    const headers = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || "").trim();
    });

    const results = { imported: 0, failed: 0, errors: [] };
    let batch = db.batch();
    let opCount = 0;

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const firstCell = row.getCell(1).value;
      if (firstCell === null || firstCell === undefined || firstCell === "") continue;

      const record = {};
      headers.forEach((h, idx) => {
        if (!h) return;
        record[h] = row.getCell(idx).value;
      });

      const { type, name, ward, department } = record;
      if (!type || !name || !ward || !department) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          message: "Missing required field(s): type, name, ward, department"
        });
        continue;
      }

      let acquisitionDate = admin.firestore.Timestamp.now();
      if (record.acquisitionDate) {
        const parsed = record.acquisitionDate instanceof Date
          ? record.acquisitionDate
          : new Date(record.acquisitionDate);
        if (!isNaN(parsed.getTime())) {
          acquisitionDate = admin.firestore.Timestamp.fromDate(parsed);
        }
      }

      const assetData = {
        orgId: req.user.orgId,
        assetCode: generateAssetCode(String(ward)),
        type: String(type).trim(),
        name: String(name).trim(),
        ward: String(ward).trim(),
        department: String(department).trim(),
        custodian: record.custodian ? String(record.custodian).trim() : null,
        status: "UNASSIGNED",
      previousStatus: null,
      statusReason: null,
        value: Number(record.value) || 0,
        location: record.location ? String(record.location).trim() : null,
        photos: [],
        acquisitionDate,
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now()
      };

      const docRef = db.collection("assets").doc();
      batch.set(docRef, assetData);
      opCount++;
      results.imported++;

      if (opCount >= 400) {
        await batch.commit();
        batch = db.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    if (results.imported > 0) {
      await db.collection("asset_audit").add({
        assetId: null,
        action: "bulk_import",
        changedBy: req.user.userId || "system",
        orgId: req.user.orgId,
        oldData: null,
        newData: { imported: results.imported, failed: results.failed },
        timestamp: admin.firestore.Timestamp.now()
      });

      await createNotification({
        type: "bulk_import",
        title: "Bulk Asset Import",
        message: `${results.imported} assets imported successfully${results.failed ? `, ${results.failed} rows skipped` : ""}`,
        department: "all",
        orgId: req.user.orgId,
        triggeredBy: req.user.name || "Admin"
      });
    }

    res.json({
      success: true,
      message: `Imported ${results.imported} asset(s)${results.failed ? `, ${results.failed} row(s) skipped` : ""}`,
      ...results
    });
  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
