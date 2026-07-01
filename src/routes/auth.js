const express = require("express");
const router = express.Router();
const {
  register, login,
  getUsers, updateUser, deleteUser,
  getProfile, updateProfile, changePassword,
  forgotPassword, resetPassword, updateUserStatus, updateProfileExpanded
} = require("../controllers/auth/authController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.post("/register", authenticate, authorizeWrite("admin"), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/users", authenticate, authorizeRoles("admin", "manager", "super-admin"), getUsers);
router.put("/users/:id", authenticate, authorizeWrite("admin"), updateUser);
router.delete("/users/:id", authenticate, authorizeWrite("admin"), deleteUser);
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.put("/profile/password", authenticate, changePassword);
router.put("/profile/expanded", authenticate, updateProfileExpanded);
router.patch("/users/:id/status", authenticate, authorizeWrite("admin"), updateUserStatus);

module.exports = router;
