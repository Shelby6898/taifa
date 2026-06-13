const express = require("express");
const router = express.Router();
const { getDepreciationReport, getAssetDepreciation } = require("../controllers/depreciationController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));
router.get("/", getDepreciationReport);
router.get("/:id", getAssetDepreciation);

module.exports = router;
