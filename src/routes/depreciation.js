const express = require("express");
const router = express.Router();
const { getDepreciationReport, getAssetDepreciation } = require("../controllers/depreciationController");
const { authenticate } = require("../middleware/authMiddleware");

router.use(authenticate);
router.get("/", getDepreciationReport);
router.get("/:id", getAssetDepreciation);

module.exports = router;
