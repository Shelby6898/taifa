const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const {
  getAssets, createAsset, getAsset, updateAsset,
  transferAsset, getAssetHistory, deleteAsset, restoreAsset,
  getWardAnalytics, getDepartmentAnalytics, getTopAssetsByValue,
  getMonthlyAcquisitions, getDepartmentMonthlyTrends,
  bulkImportAssets, bulkImportTemplate
} = require("../controllers/assetController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// Apply auth to all routes
router.use(authenticate);

router.get("/analytics/wards", getWardAnalytics);
router.get("/analytics/departments", getDepartmentAnalytics);
router.get("/analytics/top-value", getTopAssetsByValue);
router.get("/analytics/monthly-acquisitions", getMonthlyAcquisitions);
router.get("/analytics/department-monthly-trends", getDepartmentMonthlyTrends);

router.get("/bulk-import/template", bulkImportTemplate);
router.post("/bulk-import", authorizeRoles("admin"), upload.single("file"), bulkImportAssets);

router.get("/:id/history", getAssetHistory);
router.get("/:id", getAsset);
router.get("/", getAssets);

router.post("/", authorizeRoles("admin", "manager"), createAsset);
router.put("/:id", authorizeRoles("admin", "manager"), updateAsset);
router.post("/:id/transfer", authorizeRoles("admin", "manager"), transferAsset);
router.delete("/:id", authorizeRoles("admin"), deleteAsset);
router.patch("/:id/restore", authorizeRoles("admin"), restoreAsset);

module.exports = router;
