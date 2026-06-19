const express = require("express");
const router = express.Router();
const {
  register, login,
  getUsers, updateUser, deleteUser,
  getProfile, updateProfile, changePassword,
  forgotPassword, resetPassword
} = require("../controllers/auth/authController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.post("/register", authenticate, authorizeWrite("admin"), register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/users", authenticate, authorizeRoles("admin", "super-admin"), getUsers);
router.put("/users/:id", authenticate, authorizeWrite("admin"), updateUser);
router.delete("/users/:id", authenticate, authorizeWrite("admin"), deleteUser);
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.put("/profile/password", authenticate, changePassword);

module.exports = router;
