const express = require("express");
const router = express.Router();
const { getSummaryReport, getAuditReport } = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/summary", authenticate, getSummaryReport);
router.get("/audit", authenticate, getAuditReport);

module.exports = router;
