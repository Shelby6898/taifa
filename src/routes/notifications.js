const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require("../controllers/notificationController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.get("/", getNotifications);
router.put("/:id/read", markAsRead);
router.put("/mark-all/read", markAllAsRead);
router.delete("/:id", authorizeWrite("admin"), deleteNotification);

module.exports = router;
