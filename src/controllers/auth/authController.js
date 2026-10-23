const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db, admin } = require("../../config/firebase");
const crypto = require("crypto");
const { sendEmail } = require("../../services/email");

const { JWT_SECRET } = require("../../config/jwt");

/*
|--------------------------------------------------------------------------
| REGISTER USER
|--------------------------------------------------------------------------
*/

exports.register = async (req, res) => {
  try {

    const {
      name,
      email,
      password,
      role,
      department
    } = req.body;

    const existing =
      await db.collection("users")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 10);

    const user = {
      name,
      email,
      passwordHash,
      role: role || "viewer",
      department: department || null,
      orgId: req.user.role === "super-admin" ? (req.body.orgId || null) : req.user.orgId,

      employeeNumber: req.body.employeeNumber || null,
      jobTitle: req.body.jobTitle || null,
      phone: req.body.phone || null,
      profileImage: req.body.profileImage || null,
      userStatus: "active",
      loginAttempts: 0,
      lastLoginAt: null,
      createdAt: admin.firestore.Timestamp.now()
    };

    const docRef =
      await db.collection("users")
      .add(user);

    await db.collection("user_audit").add({
      userId: docRef.id,
      orgId: user.orgId,
      action: "user_created",
      changedBy: req.user?.userId || "system",
      note: "User " + name + " created with role: " + (role || "viewer"),
      newData: { name, email, role: role || "viewer", department: department || null },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.status(201).json({
      success: true,
      userId: docRef.id
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

/*
|--------------------------------------------------------------------------
| LOGIN USER
|--------------------------------------------------------------------------
*/

exports.login = async (req, res) => {
  try {

    const { email, password } = req.body;

    const snapshot =
      await db.collection("users")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    // Check user status
    if (user.userStatus === "disabled") {
      return res.status(403).json({ success: false, message: "Your account has been disabled. Contact your administrator." });
    }
    if (user.userStatus === "blocked") {
      return res.status(403).json({ success: false, message: "Your account is blocked due to too many failed login attempts. Contact your administrator." });
    }
    if (user.userStatus === "inactive") {
      return res.status(403).json({ success: false, message: "Your account is inactive. Contact your administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      // Increment login attempts
      const attempts = (user.loginAttempts || 0) + 1;
      const newStatus = attempts >= 5 ? "blocked" : user.userStatus;
      await db.collection("users").doc(userDoc.id).update({
        loginAttempts: attempts,
        userStatus: newStatus,
        updatedAt: admin.firestore.Timestamp.now()
      });
      return res.status(401).json({ success: false, message: attempts >= 5 ? "Account blocked due to too many failed attempts. Contact your administrator." : "Invalid credentials" });
    }

    // Reset login attempts on success
    await db.collection("users").doc(userDoc.id).update({
      loginAttempts: 0,
      lastLoginAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    const token = jwt.sign(
      {
        userId: userDoc.id,
        role: user.role,
        department: user.department,
        orgId: user.orgId || null,
        name: user.name || ""
      },
      JWT_SECRET,
      {
        expiresIn: "1d"
      }
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

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    let users = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      email: doc.data().email,
      role: doc.data().role,
      department: doc.data().department,
      orgId: doc.data().orgId || null,
      employeeNumber: doc.data().employeeNumber || null,
      jobTitle: doc.data().jobTitle || null,
      phone: doc.data().phone || null,
      userStatus: doc.data().userStatus || "active",
      loginAttempts: doc.data().loginAttempts || 0,
      lastLoginAt: doc.data().lastLoginAt?.toDate().toISOString() || null,
      createdAt: doc.data().createdAt?.toDate().toISOString()
    }));

    if (req.user.role !== "super-admin") {
      users = users.filter(u => u.orgId === req.user.orgId);
    }

    // Managers must have a department to list users.
    // Fail closed rather than exposing every user in the organization.
    if (req.user.role === "manager") {
      if (
        typeof req.user.department !== "string" ||
        !req.user.department.trim()
      ) {
        return res.status(403).json({
          success: false,
          message: "Manager department is required",
        });
      }

      users = users.filter(u => u.department === req.user.department);
    }

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, department } = req.body;
    const docRef = db.collection("users").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const oldData = doc.data();

    if (req.user.role !== "super-admin" && oldData.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent any user from changing their own role or department
    if (id === req.user.userId && (role || department)) {
      return res.status(400).json({ success: false, message: "You cannot change your own role or department. Ask another admin to make this change." });
    }

    const newRole = role || oldData.role;
    const newDept = department || oldData.department;
    await docRef.update({
      role: newRole,
      department: newDept,
      updatedAt: admin.firestore.Timestamp.now()
    });

    await db.collection("user_audit").add({
      userId: id,
      orgId: oldData.orgId,
      action: "user_updated",
      changedBy: req.user?.userId || "system",
      note: "Role: " + oldData.role + " → " + newRole + " | Dept: " + oldData.department + " → " + newDept,
      oldData: { role: oldData.role, department: oldData.department },
      newData: { role: newRole, department: newDept },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const userData = doc.data();

    if (req.user.role !== "super-admin" && userData.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await db.collection("users").doc(id).delete();

    await db.collection("user_audit").add({
      userId: id,
      orgId: userData.orgId,
      action: "user_deleted",
      changedBy: req.user?.userId || "system",
      note: "User " + userData.name + " deleted",
      oldData: { name: userData.name, role: userData.role, department: userData.department },
      timestamp: admin.firestore.Timestamp.now()
    });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET PROFILE
|--------------------------------------------------------------------------
*/
exports.getProfile = async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.user.userId).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });
    const data = doc.data();
    res.json({
      success: true,
      data: {
        id: doc.id,
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        orgId: data.orgId || null,
        employeeNumber: data.employeeNumber || null,
        jobTitle: data.jobTitle || null,
        phone: data.phone || null,
        profileImage: data.profileImage || null,
        userStatus: data.userStatus || "active",
        lastLoginAt: data.lastLoginAt?.toDate().toISOString() || null,
        createdAt: data.createdAt?.toDate().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const docRef = db.collection("users").doc(req.user.userId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });

    const updateData = { updatedAt: admin.firestore.Timestamp.now() };
    if (name) updateData.name = name;
    if (email) {
      // Check email not taken by another user
      const existing = await db.collection("users").where("email", "==", email).get();
      const taken = existing.docs.find(d => d.id !== req.user.userId);
      if (taken) return res.status(400).json({ success: false, message: "Email already in use" });
      updateData.email = email;
    }

    await docRef.update(updateData);
    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
*/
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const docRef = db.collection("users").doc(req.user.userId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, doc.data().passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await docRef.update({ passwordHash, updatedAt: admin.firestore.Timestamp.now() });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| FORGOT PASSWORD - request a reset link
|--------------------------------------------------------------------------
| Always responds with a generic success message, regardless of whether
| the email exists, to avoid revealing which emails are registered users.
*/

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const genericResponse = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent."
    };

    const snapshot = await db.collection("users").where("email", "==", email).get();
    if (snapshot.empty) {
      // Do not reveal whether the email exists - same response either way
      return res.status(200).json(genericResponse);
    }

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();

    // Generate a secure random token; store only its hash, never the raw token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.collection("passwordResets").add({
      userId: userDoc.id,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: admin.firestore.Timestamp.now()
    });

    const resetLink = `${process.env.BASE_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: email,
      subject: "Reset your Taifatech password",
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#1e293b;">Taifatech — Password Reset</h2>
          <p>Hi ${user.name || "there"},</p>
          <p>We received a request to reset your Taifatech password. This link expires in 30 minutes.</p>
          <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Reset Password →</a>
          <p style="margin-top:24px;color:#64748b;font-size:13px;">If you didn't request this, you can safely ignore this email — your password will not be changed.</p>
        </div>
      `
    });

    res.status(200).json(genericResponse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| RESET PASSWORD - consume a valid token and set a new password
|--------------------------------------------------------------------------
*/

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const snapshot = await db.collection("passwordResets")
      .where("tokenHash", "==", tokenHash)
      .where("used", "==", false)
      .get();

    if (snapshot.empty) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }

    const resetDoc = snapshot.docs[0];
    const resetData = resetDoc.data();

    if (resetData.expiresAt.toMillis() < Date.now()) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.collection("users").doc(resetData.userId).update({
      passwordHash,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Mark token as used so it cannot be replayed
    await resetDoc.ref.update({ used: true, usedAt: admin.firestore.Timestamp.now() });

    res.status(200).json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE USER STATUS
|--------------------------------------------------------------------------
*/
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { userStatus } = req.body;

    const validStatuses = ["active", "inactive", "disabled", "blocked"];
    if (!userStatus || !validStatuses.includes(userStatus)) {
      return res.status(400).json({ success: false, message: "userStatus must be one of: active, inactive, disabled, blocked" });
    }

    const docRef = db.collection("users").doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });

    const userData = doc.data();
    if (req.user.role !== "super-admin" && userData.orgId !== req.user.orgId) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Prevent admin from disabling themselves
    if (id === req.user.userId && userStatus !== "active") {
      return res.status(400).json({ success: false, message: "You cannot change your own status" });
    }

    const now = admin.firestore.Timestamp.now();
    await docRef.update({
      userStatus,
      loginAttempts: userStatus === "active" ? 0 : userData.loginAttempts,
      updatedAt: now
    });

    await db.collection("user_audit").add({
      userId: id,
      orgId: userData.orgId,
      action: "status_changed",
      changedBy: req.user.userId || "system",
      note: `Status changed from ${userData.userStatus || "active"} to ${userStatus}`,
      oldData: { userStatus: userData.userStatus || "active" },
      newData: { userStatus },
      timestamp: now
    });

    res.json({ success: true, message: `User status updated to ${userStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE (expanded — phone, jobTitle, employeeNumber, profileImage)
|--------------------------------------------------------------------------
*/
exports.updateProfileExpanded = async (req, res) => {
  try {
    const { name, email, phone, jobTitle, employeeNumber, profileImage } = req.body;
    const docRef = db.collection("users").doc(req.user.userId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });

    const updateData = { updatedAt: admin.firestore.Timestamp.now() };
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (jobTitle) updateData.jobTitle = jobTitle;
    if (employeeNumber) updateData.employeeNumber = employeeNumber;
    if (profileImage) updateData.profileImage = profileImage;
    if (email) {
      const existing = await db.collection("users").where("email", "==", email).get();
      const taken = existing.docs.find(d => d.id !== req.user.userId);
      if (taken) return res.status(400).json({ success: false, message: "Email already in use" });
      updateData.email = email;
    }

    await docRef.update(updateData);
    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
