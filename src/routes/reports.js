const express = require("express");
const router = express.Router();
const { getSummaryReport, getAuditReport, getTicketAuditReport, getUserAuditReport } = require("../controllers/reportController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/summary", authenticate, getSummaryReport);
router.get("/audit", authenticate, authorizeRoles("admin", "manager"), getAuditReport);
router.get("/ticket-audit", authenticate, authorizeRoles("admin", "manager"), getTicketAuditReport);
router.get("/user-audit", authenticate, authorizeRoles("admin"), getUserAuditReport);

module.exports = router;
