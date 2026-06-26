const express = require("express");
const router = express.Router();
const { getCategories, getCategory, createCategory, updateCategory, deleteCategory } = require("../controllers/categoryController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));

router.get("/", getCategories);
router.get("/:id", getCategory);
router.post("/", authorizeWrite("admin"), createCategory);
router.put("/:id", authorizeWrite("admin"), updateCategory);
router.delete("/:id", authorizeWrite("admin"), deleteCategory);

module.exports = router;
