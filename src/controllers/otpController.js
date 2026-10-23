const { db, admin } = require("../config/firebase");
const { JWT_SECRET } = require("../config/jwt");
const AfricasTalking = require("africastalking");

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME
});

const sms = at.SMS;

// Generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to user's phone
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    // Format phone to international format for Kenya
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith("254")) {
      formattedPhone = "+" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+254" + formattedPhone;
    }

    const otp = generateOTP();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP hash in Firestore
    const crypto = require("crypto");
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    await db.collection("otps").add({
      phone: formattedPhone,
      otpHash,
      expiresAt,
      used: false,
      createdAt: admin.firestore.Timestamp.now()
    });

    // Send SMS via Africa's Talking
    await sms.send({
      to: [formattedPhone],
      message: `Your Taifatech verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.AT_SENDER_ID || undefined
    });

    res.status(200).json({
      success: true,
      message: `OTP sent to ${formattedPhone}`,
      phone: formattedPhone
    });
  } catch (error) {
    console.error("OTP send error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    // Format phone
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+254" + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith("254")) {
      formattedPhone = "+" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+254" + formattedPhone;
    }

    const crypto = require("crypto");
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Find matching OTP
    const snapshot = await db.collection("otps")
      .where("phone", "==", formattedPhone)
      .where("otpHash", "==", otpHash)
      .where("used", "==", false)
      .get();

    if (snapshot.empty) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const otpDoc = snapshot.docs[0];
    const otpData = otpDoc.data();

    // Check expiry
    if (otpData.expiresAt.toMillis() < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP has expired. Request a new one." });
    }

    // Mark as used
    await otpDoc.ref.update({ used: true, usedAt: admin.firestore.Timestamp.now() });

    // Update user phone if linked to a logged-in user
    if (req.user) {
      await db.collection("users").doc(req.user.userId).update({
        phone: formattedPhone,
        phoneVerified: true,
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    res.status(200).json({ success: true, message: "OTP verified successfully", phone: formattedPhone });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2FA login — step 1: validate credentials, step 2: send OTP
exports.loginWith2FA = async (req, res) => {
  try {
    const { email, password } = req.body;

    const snapshot = await db.collection("users").where("email", "==", email).get();
    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    // Check status
    if (user.userStatus === "disabled") {
      return res.status(403).json({ success: false, message: "Account disabled. Contact administrator." });
    }
    if (user.userStatus === "blocked") {
      return res.status(403).json({ success: false, message: "Account blocked. Contact administrator." });
    }

    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      const attempts = (user.loginAttempts || 0) + 1;
      const newStatus = attempts >= 5 ? "blocked" : user.userStatus;
      await db.collection("users").doc(userDoc.id).update({
        loginAttempts: attempts,
        userStatus: newStatus,
        updatedAt: admin.firestore.Timestamp.now()
      });
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (!user.phone) {
      return res.status(400).json({ success: false, message: "No phone number on your account. Contact administrator to add one." });
    }

    // Credentials valid — send OTP
    const otp = generateOTP();
    const crypto = require("crypto");
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000);

    await db.collection("otps").add({
      phone: user.phone,
      userId: userDoc.id,
      otpHash,
      expiresAt,
      used: false,
      createdAt: admin.firestore.Timestamp.now()
    });

    await sms.send({
      to: [user.phone],
      message: `Your Taifatech login code is: ${otp}. Valid for 5 minutes. Do not share this code.`,
      from: process.env.AT_SENDER_ID || undefined
    });

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${user.phone}`,
      requires2FA: true,
      phone: user.phone
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2FA login — step 2: verify OTP and issue token
exports.verify2FALogin = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const crypto = require("crypto");
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const snapshot = await db.collection("otps")
      .where("phone", "==", phone)
      .where("otpHash", "==", otpHash)
      .where("used", "==", false)
      .get();

    if (snapshot.empty) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    const otpDoc = snapshot.docs[0];
    const otpData = otpDoc.data();

    if (otpData.expiresAt.toMillis() < Date.now()) {
      return res.status(400).json({ success: false, message: "OTP expired. Please login again." });
    }

    // Mark OTP used
    await otpDoc.ref.update({ used: true, usedAt: admin.firestore.Timestamp.now() });

    // Get user
    const userDoc = await db.collection("users").doc(otpData.userId).get();
    const user = userDoc.data();

    // Reset login attempts, update lastLoginAt
    await userDoc.ref.update({
      loginAttempts: 0,
      lastLoginAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        userId: userDoc.id,
        role: user.role,
        department: user.department,
        orgId: user.orgId || null,
        name: user.name || ""
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: userDoc.id,
        name: user.name,
        role: user.role,
        department: user.department,
        orgId: user.orgId || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
