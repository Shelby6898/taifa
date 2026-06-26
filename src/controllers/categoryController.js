const { db, admin } = require("../config/firebase");

// Get all categories for the org
exports.getCategories = async (req, res) => {
  try {
    const snapshot = await db.collection("asset_categories")
      .where("orgId", "==", req.user.orgId)
      .get();

    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single category
exports.getCategory = async (req, res) => {
  try {
    const doc = await db.collection("asset_categories").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Category not found" });

    const data = doc.data();
    if (data.orgId !== req.user.orgId && req.user.role !== "super-admin") {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.status(200).json({ success: true, data: { id: doc.id, ...data } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const { name, class: assetClass, appreciationType, appreciationRate } = req.body;

    if (!name || !assetClass || !appreciationType || appreciationRate === undefined) {
      return res.status(400).json({ success: false, message: "name, class, appreciationType and appreciationRate are required" });
    }

    if (!["CURRENT", "NON_CURRENT"].includes(assetClass)) {
      return res.status(400).json({ success: false, message: "class must be CURRENT or NON_CURRENT" });
    }

    if (!["APPRECIATION", "DEPRECIATION"].includes(appreciationType)) {
      return res.status(400).json({ success: false, message: "appreciationType must be APPRECIATION or DEPRECIATION" });
    }

    const rate = Number(appreciationRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ success: false, message: "appreciationRate must be a number between 0 and 100" });
    }

    // Check duplicate name within org
    const existing = await db.collection("asset_categories")
      .where("orgId", "==", req.user.orgId)
      .where("name", "==", name.trim())
      .get();

    if (!existing.empty) {
      return res.status(400).json({ success: false, message: `Category "${name}" already exists` });
    }

    const now = admin.firestore.Timestamp.now();
    const docRef = await db.collection("asset_categories").add({
      orgId: req.user.orgId,
      name: name.trim(),
      class: assetClass,
      appreciationType,
      appreciationRate: rate,
      createdBy: req.user.userId || "system",
      createdAt: now,
      updatedAt: now
    });

    res.status(201).json({ success: true, message: "Category created", id: docRef.id });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const docRef = db.collection("asset_categories").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Category not found" });

    const data = doc.data();
    if (data.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    const { name, class: assetClass, appreciationType, appreciationRate } = req.body;
    const updates = { updatedAt: admin.firestore.Timestamp.now() };

    if (name) updates.name = name.trim();
    if (assetClass) {
      if (!["CURRENT", "NON_CURRENT"].includes(assetClass)) {
        return res.status(400).json({ success: false, message: "class must be CURRENT or NON_CURRENT" });
      }
      updates.class = assetClass;
    }
    if (appreciationType) {
      if (!["APPRECIATION", "DEPRECIATION"].includes(appreciationType)) {
        return res.status(400).json({ success: false, message: "appreciationType must be APPRECIATION or DEPRECIATION" });
      }
      updates.appreciationType = appreciationType;
    }
    if (appreciationRate !== undefined) {
      const rate = Number(appreciationRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ success: false, message: "appreciationRate must be between 0 and 100" });
      }
      updates.appreciationRate = rate;
    }

    await docRef.update(updates);
    res.status(200).json({ success: true, message: "Category updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete category — block if assets are using it
exports.deleteCategory = async (req, res) => {
  try {
    const docRef = db.collection("asset_categories").doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "Category not found" });

    const data = doc.data();
    if (data.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Block delete if assets are linked
    const linked = await db.collection("assets")
      .where("categoryId", "==", req.params.id)
      .where("status", "!=", "DISPOSED")
      .get();

    if (!linked.empty) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${linked.size} active asset(s) are using this category`
      });
    }

    await docRef.delete();
    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
