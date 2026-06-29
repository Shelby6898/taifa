const express = require("express");
const router = express.Router();
const {
  createRequest, getRequests, getRequest,
  approveRequest, rejectRequest, getPendingCount
} = require("../controllers/assetRequestController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "viewer", "super-admin"));

router.get("/pending-count", getPendingCount);
router.get("/", getRequests);
router.get("/:id", getRequest);
router.post("/", createRequest); // all roles can request
router.patch("/:id/approve", authorizeWrite("admin", "manager"), approveRequest);
router.patch("/:id/reject", authorizeWrite("admin", "manager"), rejectRequest);

module.exports = router;
