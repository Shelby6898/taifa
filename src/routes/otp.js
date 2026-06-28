const express = require("express");
const router = express.Router();
const { sendOTP, verifyOTP, loginWith2FA, verify2FALogin } = require("../controllers/otpController");
const { authenticate } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many OTP requests. Try again in 15 minutes." }
});

// 2FA login flow
router.post("/login", otpLimiter, loginWith2FA);
router.post("/verify-login", otpLimiter, verify2FALogin);

// Standalone OTP (for phone verification)
router.post("/send", authenticate, otpLimiter, sendOTP);
router.post("/verify", authenticate, verifyOTP);

module.exports = router;
