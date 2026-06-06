const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { db } = require('../config/firebase');
const { authenticate } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/authMiddleware');
const isAdmin = authorizeRoles('admin');

// ── Helper: fetch and filter tickets ──
async function getTickets(query) {
  const { status, priority, category, search } = query;
  let ref = db.collection('tickets');
  const snap = await ref.get();

  let tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (status)   tickets = tickets.filter(t => t.status === status);
  if (priority) tickets = tickets.filter(t => t.priority === priority);
  if (category) tickets = tickets.filter(t => t.category === category);
  if (search) {
    const s = search.toLowerCase();
    tickets = tickets.filter(t =>
      (t.title || '').toLowerCase().includes(s) ||
      (t.userEmail || '').toLowerCase().includes(s) ||
      (t.userName || '').toLowerCase().includes(s) ||
      (t.id || '').toLowerCase().includes(s)
    );
  }
  return tickets;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts._seconds ? ts._seconds * 1000 : ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────
//  EXPORT EXCEL
//  GET /api/export/excel
// ─────────────────────────────────────────
router.get('/excel', authenticate, isAdmin, async (req, res, next) => {
  try {
    const tickets = await getTickets(req.query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ICT HelpDesk';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Tickets', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // ── Column definitions ──
    sheet.columns = [
      { header: 'Ticket ID',   key: 'id',             width: 28 },
      { header: 'Title',       key: 'title',          width: 32 },
      { header: 'Requester',   key: 'userName',       width: 20 },
      { header: 'Email',       key: 'userEmail',      width: 28 },
      { header: 'Category',    key: 'category',       width: 14 },
      { header: 'Priority',    key: 'priority',       width: 12 },
      { header: 'Status',      key: 'status',         width: 14 },
      { header: 'Assigned To', key: 'assignedToName', width: 20 },
      { header: 'Device',      key: 'device',         width: 20 },
      { header: 'Description', key: 'description',    width: 40 },
      { header: 'Submitted',   key: 'createdAt',      width: 22 },
    ];

    // ── Header row styling ──
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF4F46E5' } }
      };
    });
    headerRow.height = 28;

    // ── Status colors ──
    const statusColors = {
      open:          'FFFBBF24',
      assigned:      'FF22D3EE',
      'in-progress': 'FF818CF8',
      resolved:      'FF34D399',
      closed:        'FF6EE7B7'
    };

    const priorityColors = {
      high:   'FFFCA5A5',
      medium: 'FFFDE68A',
      low:    'FF6EE7B7',
      urgent: 'FFEF4444'
    };

    // ── Data rows ──
    tickets.forEach((t, i) => {
      const row = sheet.addRow({
        id:             t.id,
        title:          t.title || '—',
        userName:       t.userName || t.requester || '—',
        userEmail:      t.userEmail || '—',
        category:       t.category || '—',
        priority:       t.priority || '—',
        status:         t.status || '—',
        assignedToName: t.assignedToName || 'Unassigned',
        device:         t.device || '—',
        description:    t.description || '—',
        createdAt:      fmtDate(t.createdAt)
      });

      // Alternate row background
      const bgColor = i % 2 === 0 ? 'FFF8F9FF' : 'FFFFFFFF';
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } }
        };
      });

      // Color status cell
      const statusCell = row.getCell('status');
      if (statusColors[t.status]) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColors[t.status] } };
        statusCell.font = { bold: true };
      }

      // Color priority cell
      const priorityCell = row.getCell('priority');
      if (priorityColors[t.priority]) {
        priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityColors[t.priority] } };
        priorityCell.font = { bold: true };
      }

      row.height = 22;
    });

    // ── Summary row ──
    sheet.addRow([]);
    const summaryRow = sheet.addRow([
      `Total: ${tickets.length} tickets`,
      '', '', '', '', '', '', '', '', '',
      `Exported: ${fmtDate(Date.now())}`
    ]);
    summaryRow.eachCell(cell => {
      cell.font = { italic: true, color: { argb: 'FF94A3B8' }, size: 10 };
    });

    // ── Auto filter ──
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: sheet.columns.length }
    };

    // ── Freeze header row ──
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const filename = `tickets-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────
//  EXPORT PDF
//  GET /api/export/pdf
// ─────────────────────────────────────────
router.get('/pdf', authenticate, isAdmin, async (req, res, next) => {
  try {
    const tickets = await getTickets(req.query);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    const filename = `tickets-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 70).fill('#6366f1');
    doc.fillColor('#ffffff')
       .fontSize(22).font('Helvetica-Bold')
       .text('ICT HelpDesk', 40, 18);
    doc.fontSize(11).font('Helvetica')
       .text(`Ticket Export — ${tickets.length} tickets — ${fmtDate(Date.now())}`, 40, 46);

    doc.moveDown(3);

    // ── Table setup ──
    const cols = [
      { label: 'Ticket ID',  width: 90  },
      { label: 'Title',      width: 130 },
      { label: 'Requester',  width: 90  },
      { label: 'Category',   width: 70  },
      { label: 'Priority',   width: 60  },
      { label: 'Status',     width: 75  },
      { label: 'Assigned',   width: 90  },
      { label: 'Submitted',  width: 110 },
    ];

    const tableTop = 85;
    const rowHeight = 24;
    let startX = 30;

    // ── Table header ──
    doc.rect(startX, tableTop, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill('#1e1b4b');
    let x = startX;
    cols.forEach(col => {
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
         .text(col.label, x + 4, tableTop + 8, { width: col.width - 8 });
      x += col.width;
    });

    // ── Table rows ──
    const statusColors2 = {
      open: '#fbbf24', assigned: '#22d3ee',
      'in-progress': '#818cf8', resolved: '#34d399', closed: '#6ee7b7'
    };
    const priorityColors2 = {
      high: '#f87171', medium: '#fbbf24', low: '#34d399', urgent: '#ef4444'
    };

    tickets.forEach((t, i) => {
      const y = tableTop + rowHeight + (i * rowHeight);

      // Check if we need a new page
      if (y + rowHeight > doc.page.height - 40) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 40 });
        return;
      }

      // Alternate row background
      const bg = i % 2 === 0 ? '#f8f9ff' : '#ffffff';
      doc.rect(startX, y, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill(bg);

      const rowData = [
        (t.id || '').substring(0, 16),
        (t.title || '—').substring(0, 28),
        (t.userName || t.requester || '—').substring(0, 18),
        t.category || '—',
        t.priority || '—',
        t.status || '—',
        (t.assignedToName || 'Unassigned').substring(0, 18),
        fmtDate(t.createdAt).substring(0, 20)
      ];

      x = startX;
      rowData.forEach((val, idx) => {
        const col = cols[idx];

        // Color badges for status and priority
        if (idx === 5 && statusColors2[t.status]) {
          doc.roundedRect(x + 3, y + 5, col.width - 8, 14, 3).fill(statusColors2[t.status]);
          doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold')
             .text(val.toUpperCase(), x + 4, y + 9, { width: col.width - 10 });
        } else if (idx === 4 && priorityColors2[t.priority]) {
          doc.roundedRect(x + 3, y + 5, col.width - 8, 14, 3).fill(priorityColors2[t.priority]);
          doc.fillColor('#1e293b').fontSize(7).font('Helvetica-Bold')
             .text(val.toUpperCase(), x + 4, y + 9, { width: col.width - 10 });
        } else {
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
             .text(val, x + 4, y + 8, { width: col.width - 8 });
        }

        // Column divider
        doc.moveTo(x + col.width, y).lineTo(x + col.width, y + rowHeight)
           .strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        x += col.width;
      });

      // Row bottom border
      doc.moveTo(startX, y + rowHeight)
         .lineTo(startX + cols.reduce((s, c) => s + c.width, 0), y + rowHeight)
         .strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    });

    // ── Footer ──
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica')
       .text(`ICT HelpDesk — Generated ${fmtDate(Date.now())}`,
         40, doc.page.height - 30, { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
