const express = require("express");
const router = express.Router();
const {
  createOrganization, getOrganizations,
  getMyOrganization, updateMyOrganization
} = require("../controllers/organizationController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/mine", getMyOrganization);
router.put("/mine", authorizeRoles("admin", "super-admin"), updateMyOrganization);

router.get("/", authorizeRoles("super-admin"), getOrganizations);
router.post("/", authorizeRoles("super-admin"), createOrganization);

module.exports = router;
