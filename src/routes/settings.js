const express = require("express");
const router = express.Router();
const { db, admin } = require("../config/firebase");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);

// GET system settings
router.get("/", async (req, res) => {
  try {
    const doc = await db.collection("settings").doc("system").get();
    const defaults = {
      slaTargets: {
        urgent: { response: 60,   resolution: 240  },
        high:   { response: 240,  resolution: 480  },
        medium: { response: 480,  resolution: 1440 },
        low:    { response: 1440, resolution: 4320 },
      },
      emailNotifications: true,
      assetTypes: ["ICT Equipment","Furniture","Vehicle","Land","Building","Machinery","Other"],
      departments: ["Finance","ICT","Health","Education","Roads","Water","Administration","Revenue","Agriculture"],
    };
    const data = doc.exists ? { ...defaults, ...doc.data() } : defaults;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE system settings (admin only)
router.put("/", authorizeRoles("admin", "super-admin"), async (req, res) => {
  try {
    await db.collection("settings").doc("system").set({
      ...req.body,
      updatedAt: admin.firestore.Timestamp.now(),
      updatedBy: req.user.userId
    }, { merge: true });
    res.json({ success: true, message: "Settings updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
