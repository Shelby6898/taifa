const express = require("express");
const router = express.Router();
const {
  register, login,
  getUsers, updateUser, deleteUser,
  getProfile, updateProfile, changePassword
} = require("../controllers/auth/authController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/register", authenticate, authorizeRoles("admin", "super-admin"), register);
router.post("/login", login);
router.get("/users", authenticate, authorizeRoles("admin", "super-admin"), getUsers);
router.put("/users/:id", authenticate, authorizeRoles("admin", "super-admin"), updateUser);
router.delete("/users/:id", authenticate, authorizeRoles("admin", "super-admin"), deleteUser);
router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);
router.put("/profile/password", authenticate, changePassword);

module.exports = router;
