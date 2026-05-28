const express = require("express");
const router = express.Router();
const { getTransfers, createTransfer } = require("../controllers/transferController");

router.get("/", getTransfers);
router.post("/", createTransfer);

module.exports = router;
