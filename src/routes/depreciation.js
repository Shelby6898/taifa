const express = require("express");
const router = express.Router();
const { getDepreciationReport, getAssetDepreciation } = require("../controllers/depreciationController");
const { createValuation, getValuationLog, runDailyValuation } = require("../controllers/valuationController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));
router.get("/", getDepreciationReport);
router.get("/:id", getAssetDepreciation);
router.post("/:id/valuations", createValuation);
router.get("/:id/valuations", getValuationLog);
router.post("/run-daily-valuation", runDailyValuation);

module.exports = router;
