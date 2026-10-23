const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");

// Escape database values before inserting them into HTML text.
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Only allow known CSS classes; never use database text as a class.
function statusClass(status) {
  switch (String(status || "").toUpperCase()) {
    case "DISPOSED": return "deleted";
    case "MAINTENANCE": return "maintenance";
    case "ASSIGNED": return "active";
    default: return "unassigned";
  }
}

// Public asset view - no auth required (for QR scanning)
router.get("/:id", async (req, res) => {
  // Harden the public QR page without changing other routes.
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
  });

  try {
    const { id } = req.params;
    const doc = await db.collection("assets").doc(id).get();
    if (!doc.exists) {
      return res.status(404).send(`
        <html><body style="font-family:sans-serif;padding:40px;text-align:center">
          <h2>Asset Not Found</h2>
          <p>This asset does not exist or has been removed.</p>
        </body></html>
      `);
    }
    const a = { assetId: doc.id, ...doc.data() };
    const acquisitionDate = a.acquisitionDate;
    let acqDate = "N/A";

    if (acquisitionDate) {
      let dateValue = null;

      if (typeof acquisitionDate.toDate === "function") {
        dateValue = acquisitionDate.toDate();
      } else if (typeof acquisitionDate._seconds === "number") {
        dateValue = new Date(acquisitionDate._seconds * 1000);
      } else if (acquisitionDate instanceof Date) {
        dateValue = acquisitionDate;
      }

      if (
        dateValue instanceof Date &&
        Number.isFinite(dateValue.getTime())
      ) {
        acqDate = dateValue.toLocaleDateString("en-GB");
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>${escapeHtml(a.name || 'Asset')} — Taifa Asset</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: sans-serif; background: #f8fafc; color: #1e293b; }
          .header { background: #1e293b; color: white; padding: 20px 24px; display: flex; align-items: center; gap: 12px; }
          .header h1 { font-size: 18px; }
          .header p { font-size: 12px; color: #94a3b8; margin-top: 2px; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
          .active { background: #dcfce7; color: #166534; }
          .deleted { background: #fee2e2; color: #991b1b; }
          .maintenance { background: #fef3c7; color: #92400e; }
          .unassigned { background: #f1f5f9; color: #475569; }
          .card { background: white; border-radius: 12px; padding: 20px; margin: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
          .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
          .row:last-child { border-bottom: none; }
          .label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }
          .value { font-size: 14px; color: #1e293b; font-weight: 500; text-align: right; }
          .code { font-family: monospace; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 13px; }
          .footer { text-align: center; padding: 20px; color: #94a3b8; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>🏛️ ${escapeHtml(a.name || 'Asset')}</h1>
            <p>Taifa County Asset Management</p>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <span class="code">${escapeHtml(a.assetCode || "N/A")}</span>
            <span class="badge ${statusClass(a.status)}">${escapeHtml(a.status || "UNKNOWN")}</span>
          </div>
          <div class="row"><span class="label">Type</span><span class="value">${escapeHtml(a.type || "N/A")}</span></div>
          <div class="row"><span class="label">Department</span><span class="value">${escapeHtml(a.department || "N/A")}</span></div>
          <div class="row"><span class="label">Ward</span><span class="value">${escapeHtml(a.ward || "N/A")}</span></div>



          <div class="row"><span class="label">Acquired</span><span class="value">${acqDate}</span></div>
        </div>
        <div class="footer">
          Taifa County Government &nbsp;|&nbsp; Official Asset Record<br/>
          Scanned on ${new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })}
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send("<h2>Error loading asset</h2>");
  }
});

module.exports = router;
