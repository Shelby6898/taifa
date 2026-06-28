const express = require("express");
const router = express.Router();
const {
  uploadDocument, getAssetDocuments, downloadDocument,
  deleteDocument, getDocumentCategories
} = require("../controllers/documentController");
const { authenticate, authorizeRoles, authorizeWrite } = require("../middleware/authMiddleware");

router.use(authenticate);
router.use(authorizeRoles("admin", "manager", "super-admin"));

router.get("/categories", getDocumentCategories);
router.get("/:id/documents", getAssetDocuments);
router.post("/:id/documents", authorizeWrite("admin", "manager"), uploadDocument);
router.get("/:id/documents/:docId", downloadDocument);
router.delete("/:id/documents/:docId", authorizeWrite("admin"), deleteDocument);

module.exports = router;
