const express = require("express");
const router = express.Router();
const { getSummaryReport, getAuditReport, getTicketAuditReport, getUserAuditReport } = require("../controllers/reportController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.get("/summary", authenticate, getSummaryReport);
router.get("/audit", authenticate, authorizeRoles("admin", "manager", "super-admin"), getAuditReport);
router.get("/ticket-audit", authenticate, authorizeRoles("admin", "manager", "super-admin"), getTicketAuditReport);
router.get("/user-audit", authenticate, authorizeRoles("admin", "super-admin"), getUserAuditReport);

module.exports = router;
