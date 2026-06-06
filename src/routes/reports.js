const express = require("express");
const router = express.Router();
const { getSummaryReport, getAuditReport, getTicketAuditReport } = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/summary", authenticate, getSummaryReport);
router.get("/audit", authenticate, getAuditReport);
router.get("/ticket-audit", authenticate, getTicketAuditReport);

module.exports = router;
