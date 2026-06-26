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
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");
const { assignCustodian, releaseCustodian, getCustodyLog } = require("../controllers/custodyController");

// Apply auth to all routes
router.use(authenticate);

router.get("/analytics/wards", getWardAnalytics);
router.get("/analytics/departments", getDepartmentAnalytics);
router.get("/analytics/top-value", getTopAssetsByValue);
router.get("/analytics/monthly-acquisitions", getMonthlyAcquisitions);
router.get("/analytics/department-monthly-trends", getDepartmentMonthlyTrends);

router.get("/bulk-import/template", bulkImportTemplate);
router.post("/bulk-import", authorizeWrite("admin"), upload.single("file"), bulkImportAssets);

router.get("/:id/history", getAssetHistory);
router.get("/:id", getAsset);
router.get("/", getAssets);

router.post("/", authorizeWrite("admin", "manager"), createAsset);
router.put("/:id", authorizeWrite("admin", "manager"), updateAsset);
router.post("/:id/transfer", authorizeWrite("admin", "manager"), transferAsset);
router.delete("/:id", authorizeWrite("admin"), deleteAsset);
router.patch("/:id/restore", authorizeWrite("admin"), restoreAsset);
router.post("/:id/custodian", authorizeWrite("admin", "manager"), assignCustodian);
router.delete("/:id/custodian", authorizeWrite("admin"), releaseCustodian);
router.get("/:id/custody-log", getCustodyLog);

module.exports = router;
