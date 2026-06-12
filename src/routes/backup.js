const express = require("express");
const router = express.Router();
const { runBackup } = require("../controllers/backupController");

router.get("/run", runBackup);
router.post("/run", runBackup);

module.exports = router;
