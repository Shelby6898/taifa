const express = require("express");
const router = express.Router();
const {
  checkOut, checkIn, flagMissing, flagInactive,
  getCheckedOutAssets, getFlaggedAssets
} = require("../controllers/checkInOutController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));

router.get("/checked-out", getCheckedOutAssets);
router.get("/flagged", getFlaggedAssets);
router.post("/:id/checkout", authorizeWrite("admin", "manager"), checkOut);
router.post("/:id/checkin", authorizeWrite("admin", "manager"), checkIn);
router.post("/:id/flag-missing", authorizeWrite("admin"), flagMissing);
router.post("/:id/flag-inactive", authorizeWrite("admin"), flagInactive);

module.exports = router;
