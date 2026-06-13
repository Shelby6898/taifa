const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");

/*
|--------------------------------------------------------------------------
| CREATE ORGANIZATION (super-admin only)
| Creates the org + its first admin user
|--------------------------------------------------------------------------
*/
exports.createOrganization = async (req, res) => {
  try {
    const {
      name, type,
      locationLabel, locationLabelPlural,
      unitLabel, unitLabelPlural,
      locations, units,
      adminName, adminEmail, adminPassword
    } = req.body;

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: "name, adminName, adminEmail and adminPassword are required"
      });
    }

    const existing = await db.collection("users").where("email", "==", adminEmail).get();
    if (!existing.empty) {
      return res.status(400).json({ success: false, message: "A user with this email already exists" });
    }

    const orgData = {
      name,
      type: type || "other",
      locationLabel: locationLabel || "Location",
      locationLabelPlural: locationLabelPlural || `${locationLabel || "Location"}s`,
      unitLabel: unitLabel || "Department",
      unitLabelPlural: unitLabelPlural || `${unitLabel || "Department"}s`,
      locations: Array.isArray(locations) ? locations : [],
      units: Array.isArray(units) ? units : [],
      status: "active",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };

    const orgRef = await db.collection("organizations").add(orgData);

    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const userRef = await db.collection("users").add({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "admin",
      department: null,
      orgId: orgRef.id,
      createdAt: admin.firestore.Timestamp.now()
    });

    res.status(201).json({
      success: true,
      organizationId: orgRef.id,
      adminUserId: userRef.id,
      message: "Organization and admin user created successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| LIST ORGANIZATIONS (super-admin only)
|--------------------------------------------------------------------------
*/
exports.getOrganizations = async (req, res) => {
  try {
    const snapshot = await db.collection("organizations").get();
    const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, count: orgs.length, data: orgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET MY ORGANIZATION (any authenticated user)
|--------------------------------------------------------------------------
*/
exports.getMyOrganization = async (req, res) => {
  try {
    if (!req.user.orgId) {
      return res.status(404).json({ success: false, message: "No organization associated with this account" });
    }
    const doc = await db.collection("organizations").doc(req.user.orgId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Organization not found" });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE MY ORGANIZATION (admin only, own org)
|--------------------------------------------------------------------------
*/
exports.updateMyOrganization = async (req, res) => {
  try {
    if (!req.user.orgId) {
      return res.status(404).json({ success: false, message: "No organization associated with this account" });
    }
    const { name, locations, units, locationLabel, locationLabelPlural, unitLabel, unitLabelPlural } = req.body;
    const updateData = { updatedAt: admin.firestore.Timestamp.now() };
    if (name) updateData.name = name;
    if (Array.isArray(locations)) updateData.locations = locations;
    if (Array.isArray(units)) updateData.units = units;
    if (locationLabel) updateData.locationLabel = locationLabel;
    if (locationLabelPlural) updateData.locationLabelPlural = locationLabelPlural;
    if (unitLabel) updateData.unitLabel = unitLabel;
    if (unitLabelPlural) updateData.unitLabelPlural = unitLabelPlural;

    await db.collection("organizations").doc(req.user.orgId).update(updateData);
    res.json({ success: true, message: "Organization updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
