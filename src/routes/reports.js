const express = require("express");
const router = express.Router();
const { getSummaryReport, getAuditReport } = require("../controllers/reportController");

router.get("/summary", getSummaryReport);
router.get("/audit", getAuditReport);

module.exports = router;
