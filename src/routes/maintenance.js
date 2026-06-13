const express = require("express");
const router = express.Router();
const {
  getMaintenanceRecords,
  getMaintenanceRecord,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord
} = require("../controllers/maintenanceController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/", getMaintenanceRecords);
router.get("/:id", getMaintenanceRecord);
router.post("/", authorizeRoles("admin", "manager", "super-admin"), createMaintenanceRecord);
router.put("/:id", authorizeRoles("admin", "manager", "super-admin"), updateMaintenanceRecord);
router.delete("/:id", authorizeRoles("admin", "super-admin"), deleteMaintenanceRecord);

module.exports = router;
