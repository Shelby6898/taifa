const express = require("express");
const router = express.Router();
const { ifmisIntake, getIfmisAssets } = require("../controllers/ifmisController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// IFMIS intake — no user auth, uses IFMIS secret header instead
router.post("/intake", ifmisIntake);

// View IFMIS assets — requires user auth
router.get("/assets", authenticate, authorizeRoles("admin", "super-admin"), getIfmisAssets);

module.exports = router;
