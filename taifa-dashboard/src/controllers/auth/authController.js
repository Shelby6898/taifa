const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, admin } = require("../../config/firebase");

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

/*
|--------------------------------------------------------------------------
| REGISTER USER
|--------------------------------------------------------------------------
*/
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    const existing = await db.collection("users")
      .where("email", "==", email)
      .get();

    if (!existing.empty) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      name,
      email,
      passwordHash,
      role: role || "viewer",
      department: department || null,
      createdAt: admin.firestore.Timestamp.now()
    };

    const docRef = await db.collection("users").add(user);

    res.status(201).json({
      success: true,
      userId: docRef.id
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const snapshot = await db.collection("users")
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

    const isMatch = await bcrypt.compare(password, user.passwordHash);

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
        department: user.department
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
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
    res.status(500).json({ success: false, message: err.message });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL USERS (admin only)
|--------------------------------------------------------------------------
*/
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

/*
|--------------------------------------------------------------------------
| UPDATE USER ROLE (admin only)
|--------------------------------------------------------------------------
*/
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

/*
|--------------------------------------------------------------------------
| DELETE USER (admin only)
|--------------------------------------------------------------------------
*/
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
