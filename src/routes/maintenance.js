const express = require("express");
const router = express.Router();
const {
  getMaintenanceRecords,
  getMaintenanceRecord,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord
} = require("../controllers/maintenanceController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/", getMaintenanceRecords);
router.get("/:id", getMaintenanceRecord);
router.post("/", authorizeWrite("admin", "manager"), createMaintenanceRecord);
router.put("/:id", authorizeWrite("admin", "manager"), updateMaintenanceRecord);
router.delete("/:id", authorizeWrite("admin"), deleteMaintenanceRecord);

module.exports = router;
