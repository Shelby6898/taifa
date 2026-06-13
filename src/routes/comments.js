const express = require('express');
const router = express.Router({ mergeParams: true });
const { db, admin } = require('../config/firebase');
const { sendEmail } = require('../services/email');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const canComment = authorizeRoles('admin', 'manager', 'viewer', 'user', 'super-admin');

// ─────────────────────────────────────────
//  GET COMMENTS FOR A TICKET
//  GET /api/tickets/:id/comments
// ─────────────────────────────────────────
router.get('/', authenticate, canComment, async (req, res, next) => {
  try {
    const ticketRef = db.collection('tickets').doc(req.params.id);
    const ticketDoc = await ticketRef.get();
    if (!ticketDoc.exists) return res.status(404).json({ error: 'Ticket not found.' });

    // Only allow ticket owner or admin
    const ticket = ticketDoc.data();
    if (!['admin','manager'].includes(req.user.role) && ticket.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const snap = await ticketRef
      .collection('comments')
      
      .get();

    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ comments });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
//  ADD COMMENT
//  POST /api/tickets/:id/comments
// ─────────────────────────────────────────
router.post('/', authenticate, canComment, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const ticketRef = db.collection('tickets').doc(req.params.id);
    const ticketDoc = await ticketRef.get();
    if (!ticketDoc.exists) return res.status(404).json({ error: 'Ticket not found.' });

    const ticket = ticketDoc.data();

    // Only allow ticket owner or admin
    if (!['admin','manager'].includes(req.user.role) && ticket.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch author name from DB
    const authorDoc = await db.collection('users').doc(req.user.userId).get();
    const authorName = authorDoc.exists ? authorDoc.data().name : 'Unknown';

    const comment = {
      message: message.trim(),
      authorId:   req.user.userId,
      authorName: authorName,
      authorRole: req.user.role,
      createdAt:  admin.firestore.FieldValue.serverTimestamp()
    };

    const commentRef = await ticketRef.collection('comments').add(comment);

    // ── Email notification ──
    if (req.user.role === 'admin') {
      // Admin replied — notify the user
      if (ticket.userEmail) {
        await sendEmail({
          to: ticket.userEmail,
          subject: `💬 New Reply on Your Ticket: ${ticket.title}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#6366f1;">ICT HelpDesk</h2>
              <p>Hi ${ticket.userName || ticket.requester || 'there'},</p>
              <p>An ICT team member has replied to your ticket.</p>
              <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 8px;"><strong>Ticket:</strong> ${ticket.title}</p>
                <p style="margin:0 0 8px;"><strong>Reply from:</strong> ${authorName}</p>
                <div style="background:#ffffff;border-left:4px solid #6366f1;padding:12px;border-radius:4px;margin-top:12px;">
                  <p style="margin:0;color:#334155;">${message.trim()}</p>
                </div>
              </div>
              <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Ticket →</a>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
              <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
            </div>
          `
        });
      }
    } else {
      // User replied — notify all admins
      const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
      const adminEmails = adminsSnap.docs.map(d => d.data().email);
      if (adminEmails.length) {
        await sendEmail({
          to: adminEmails,
          subject: `💬 User Replied on Ticket: ${ticket.title}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
              <h2 style="color:#6366f1;">ICT HelpDesk</h2>
              <p>A user has replied to a ticket.</p>
              <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
                <p style="margin:0 0 8px;"><strong>Ticket:</strong> ${ticket.title}</p>
                <p style="margin:0 0 8px;"><strong>From:</strong> ${authorName}</p>
                <div style="background:#ffffff;border-left:4px solid #22d3ee;padding:12px;border-radius:4px;margin-top:12px;">
                  <p style="margin:0;color:#334155;">${message.trim()}</p>
                </div>
              </div>
              <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Open HelpDesk →</a>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
              <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
            </div>
          `
        });
      }
    }

    res.status(201).json({ id: commentRef.id, ...comment });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
