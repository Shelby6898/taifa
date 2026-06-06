const express = require("express");
const router = express.Router();
const {
  getTransfers,
  createTransfer,
  approveTransfer,
  denyTransfer
} = require("../controllers/transferController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.use(authenticate);

router.get("/",    getTransfers);
router.post("/",   authorizeRoles("admin", "manager"), createTransfer);
router.patch("/:id/approve", authorizeRoles("admin"), approveTransfer);
router.patch("/:id/deny",    authorizeRoles("admin"), denyTransfer);

module.exports = router;
