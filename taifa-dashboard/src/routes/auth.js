const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getUsers,
  updateUser,
  deleteUser
} = require("../controllers/auth/authController");
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/users", authenticate, authorizeRoles("admin"), getUsers);
router.put("/users/:id", authenticate, authorizeRoles("admin"), updateUser);
router.delete("/users/:id", authenticate, authorizeRoles("admin"), deleteUser);

module.exports = router;
