const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { sendEmail } = require('../services/email');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/authMiddleware');
const isAdmin = authorizeRoles('admin');
const canSubmit = authorizeRoles('admin', 'manager', 'viewer', 'user');

const VALID_CATEGORIES = ['hardware', 'software', 'network', 'account', 'other'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_STATUSES   = ['open', 'assigned', 'in-progress', 'resolved', 'closed'];

// GET TICKETS
router.get('/', authenticate, async (req, res, next) => {
  try {
    let query = db.collection('tickets');
    const snap = await query.get();
    let docs = snap.docs;
    if (req.user.role === 'admin') {
      // admin sees all
    } else if (req.user.role === 'manager') {
      // manager sees only their department
      docs = docs.filter(d => d.data().department === req.user.department);
    } else {
      // viewer/user sees only their own tickets
      docs = docs.filter(d => d.data().userId === req.user.userId);
    }
    const tickets = docs.map(d => {
      const data = d.data();
      return {
        id: d.id, ...data,
        requester: data.requester || data.userEmail || 'Unknown',
        category:  data.category  || 'other',
        priority:  data.priority  || 'medium',
        userEmail: data.userEmail || '',
        userName:  data.userName  || data.requester || ''
      };
    });
    res.json({ tickets });
  } catch (err) { next(err); }
});

// CREATE TICKET
router.post('/', authenticate, canSubmit, async (req, res, next) => {
  try {
    const { title, description, category, priority, device, department } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required.' });
    }

    const userDoc = await db.collection('users').doc(req.user.userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const requesterName = userData.name || 'Unknown';
    const requesterEmail = userData.email || '';

    const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'other';
    const finalPriority = VALID_PRIORITIES.includes(priority) ? priority : 'medium';

    const docRef = await db.collection('tickets').add({
      title, description, device: device || '',
      category:  finalCategory,
      priority:  finalPriority,
      requester: requesterName,
      userName:  requesterName,
      userEmail: requesterEmail,
      userId:    req.user.userId,
      department: req.user.department || department || 'General',
      status:    'open',
      assignedTo: null, assignedToName: null, assignedToEmail: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ── 1. Confirmation email to the user ──
    await sendEmail({
      to: requesterEmail,
      subject: `✅ Ticket Received: ${title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#6366f1;">ICT HelpDesk</h2>
          <p>Hi ${requesterName},</p>
          <p>Your ticket has been received and our ICT team will get back to you shortly.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${docRef.id}</p>
            <p style="margin:0 0 8px;"><strong>Title:</strong> ${title}</p>
            <p style="margin:0 0 8px;"><strong>Category:</strong> ${finalCategory}</p>
            <p style="margin:0 0 8px;"><strong>Priority:</strong> ${finalPriority}</p>
            <p style="margin:0;"><strong>Device:</strong> ${device || '—'}</p>
          </div>
          <p style="color:#64748b;font-size:13px;">You will be notified when your ticket is updated.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
          <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
        </div>
      `
    });

    // ── 2. Notification email to all admins ──
    const adminsSnap = await db.collection('users').where('role', '==', 'admin').get();
    const adminEmails = adminsSnap.docs.map(d => d.data().email);

    if (adminEmails.length) {
      await sendEmail({
        to: adminEmails,
        subject: `🎫 New Ticket: ${title}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#ef4444;">ICT HelpDesk — New Ticket</h2>
            <p>A new support ticket has been submitted.</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${docRef.id}</p>
              <p style="margin:0 0 8px;"><strong>Title:</strong> ${title}</p>
              <p style="margin:0 0 8px;"><strong>Submitted by:</strong> ${requesterName} (${requesterEmail})</p>
              <p style="margin:0 0 8px;"><strong>Category:</strong> ${finalCategory}</p>
              <p style="margin:0 0 8px;"><strong>Priority:</strong> ${finalPriority}</p>
              <p style="margin:0 0 8px;"><strong>Device:</strong> ${device || '—'}</p>
              <p style="margin:0;"><strong>Description:</strong> ${description}</p>
            </div>
            <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Open HelpDesk →</a>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
            <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
          </div>
        `
      });
    }

    res.status(201).json({ id: docRef.id, message: 'Ticket created.' });
  } catch (err) { next(err); }
});

// UPDATE STATUS
router.patch('/:id/status', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Use: ${VALID_STATUSES.join(', ')}` });
    }
    const ref = db.collection('tickets').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ticket not found.' });

    const ticket = doc.data();

    await ref.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    // ── Notify user when status changes ──
    if (ticket.userEmail) {
      await sendEmail({
        to: ticket.userEmail,
        subject: `🔄 Ticket Update: ${ticket.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#6366f1;">ICT HelpDesk</h2>
            <p>Hi ${ticket.userName || ticket.requester || 'there'},</p>
            <p>Your ticket status has been updated.</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
              <p style="margin:0 0 8px;"><strong>Ticket:</strong> ${ticket.title}</p>
              <p style="margin:0;"><strong>New Status:</strong> <span style="color:#6366f1;font-weight:600;">${status}</span></p>
            </div>
            <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">View Ticket →</a>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
            <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
          </div>
        `
      });
    }

    res.json({ message: 'Status updated.', status });
  } catch (err) { next(err); }
});

// ASSIGN TICKET
router.patch('/:id/assign', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ error: 'agentId is required.' });
    const agentDoc = await db.collection('users').doc(agentId).get();
    if (!agentDoc.exists) return res.status(404).json({ error: 'Agent not found.' });
    const agent = agentDoc.data();
    if (agent.role !== 'admin') {
      return res.status(400).json({ error: 'Assignee must be an admin.' });
    }
    const ticketRef = db.collection('tickets').doc(req.params.id);
    const ticketDoc = await ticketRef.get();
    if (!ticketDoc.exists) return res.status(404).json({ error: 'Ticket not found.' });
    const ticket = ticketDoc.data();
    await ticketRef.update({
      assignedTo: agentId, assignedToEmail: agent.email, assignedToName: agent.name,
      assignedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'assigned', updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ── Notify assigned admin ──
    await sendEmail({
      to: agent.email,
      subject: `📋 Ticket Assigned to You: ${ticket.title}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#6366f1;">ICT HelpDesk</h2>
          <p>Hi ${agent.name},</p>
          <p>A ticket has been assigned to you.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;"><strong>Ticket ID:</strong> ${req.params.id}</p>
            <p style="margin:0 0 8px;"><strong>Title:</strong> ${ticket.title}</p>
            <p style="margin:0 0 8px;"><strong>Submitted by:</strong> ${ticket.requester || ticket.userEmail}</p>
            <p style="margin:0 0 8px;"><strong>Category:</strong> ${ticket.category || 'other'}</p>
            <p style="margin:0;"><strong>Priority:</strong> ${ticket.priority || 'medium'}</p>
          </div>
          <a href="${process.env.BASE_URL}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Open HelpDesk →</a>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
          <p style="color:#94a3b8;font-size:12px;">ICT HelpDesk — ${process.env.BASE_URL}</p>
        </div>
      `
    });

    res.json({ message: 'Ticket assigned.', assignedTo: { id: agentId, name: agent.name, email: agent.email } });
  } catch (err) { next(err); }
});

// UNASSIGN TICKET
router.patch('/:id/unassign', authenticate, isAdmin, async (req, res, next) => {
  try {
    const ref = db.collection('tickets').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ticket not found.' });
    await ref.update({
      assignedTo: null, assignedToEmail: null, assignedToName: null,
      assignedAt: null, status: 'open',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ message: 'Ticket unassigned.' });
  } catch (err) { next(err); }
});

// UPDATE TICKET FIELDS
router.patch('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const { category, priority } = req.body;
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (category) {
      if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
      updates.category = category;
    }
    if (priority) {
      if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority.' });
      updates.priority = priority;
    }
    const ref = db.collection('tickets').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ticket not found.' });
    await ref.update(updates);
    res.json({ message: 'Ticket updated.', ...updates });
  } catch (err) { next(err); }
});

// DELETE TICKET
router.delete('/:id', authenticate, isAdmin, async (req, res, next) => {
  try {
    const ref = db.collection('tickets').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ticket not found.' });
    await ref.delete();
    res.json({ message: 'Ticket deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
