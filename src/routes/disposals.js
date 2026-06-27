const express = require("express");
const router = express.Router();
const { disposeAsset, getAssetDisposal, getOrgDisposals, getDisposalMethods } = require("../controllers/disposalController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));

router.get("/methods", getDisposalMethods);
router.get("/", getOrgDisposals);
router.post("/:id/dispose", authorizeWrite("admin"), disposeAsset);
router.get("/:id/disposal", getAssetDisposal);

module.exports = router;
