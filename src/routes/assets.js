const express = require("express");
const router = express.Router();
const {
  getAssets, createAsset, getAsset, updateAsset,
  transferAsset, getAssetHistory, deleteAsset, restoreAsset,
  getWardAnalytics, getDepartmentAnalytics, getTopAssetsByValue,
  getMonthlyAcquisitions, getDepartmentMonthlyTrends
} = require("../controllers/assetController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// Apply auth to all routes
router.use(authenticate);

router.get("/analytics/wards", getWardAnalytics);
router.get("/analytics/departments", getDepartmentAnalytics);
router.get("/analytics/top-value", getTopAssetsByValue);
router.get("/analytics/monthly-acquisitions", getMonthlyAcquisitions);
router.get("/analytics/department-monthly-trends", getDepartmentMonthlyTrends);
router.get("/:id/history", getAssetHistory);
router.get("/:id", getAsset);
router.get("/", getAssets);

router.post("/", authorizeRoles("admin", "manager"), createAsset);
router.put("/:id", authorizeRoles("admin", "manager"), updateAsset);
router.post("/:id/transfer", authorizeRoles("admin", "manager"), transferAsset);
router.delete("/:id", authorizeRoles("admin"), deleteAsset);
router.patch("/:id/restore", authorizeRoles("admin"), restoreAsset);

module.exports = router;
