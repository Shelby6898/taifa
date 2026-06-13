const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/authMiddleware');
const isAdmin = authorizeRoles('admin', 'super-admin');

router.get('/agents', authenticate, isAdmin, async (req, res, next) => {
  try {
    const snap = await db
      .collection('users')
      .where('role', '==', 'admin')
      .get();

    const agents = snap.docs.map(d => ({
      id:    d.id,
      name:  d.data().name,
      email: d.data().email
    }));

    res.json({ agents });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
