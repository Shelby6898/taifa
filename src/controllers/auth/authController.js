const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db, admin } = require("../../config/firebase");

const JWT_SECRET =
  process.env.JWT_SECRET || "secret_key";

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

      createdAt:
        admin.firestore.Timestamp.now()
    };

    const docRef =
      await db.collection("users")
      .add(user);

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
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const userDoc = snapshot.docs[0];

    const user = userDoc.data();

    const isMatch =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        userId: userDoc.id,
        role: user.role,
        department: user.department,
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
        department: user.department
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
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      email: doc.data().email,
      role: doc.data().role,
      department: doc.data().department,
      createdAt: doc.data().createdAt?.toDate().toISOString()
    }));
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
    await docRef.update({
      role: role || doc.data().role,
      department: department || doc.data().department,
      updatedAt: admin.firestore.Timestamp.now()
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
    await db.collection("users").doc(id).delete();
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
