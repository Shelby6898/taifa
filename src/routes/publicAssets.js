const express = require("express");
const router = express.Router();
const { db } = require("../config/firebase");

// Public asset view - no auth required (for QR scanning)
router.get("/:id", async (req, res) => {
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
    const acqDate = a.acquisitionDate
      ? new Date(a.acquisitionDate._seconds * 1000).toLocaleDateString("en-GB")
      : "N/A";

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>${a.name} — Taifa Asset</title>
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
            <h1>🏛️ ${a.name}</h1>
            <p>Taifa County Asset Management</p>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <span class="code">${a.assetCode || "N/A"}</span>
            <span class="badge ${a.status === "DISPOSED" ? "deleted" : a.status === "MAINTENANCE" ? "maintenance" : a.status === "ASSIGNED" ? "active" : "unassigned"}">${a.status}</span>
          </div>
          <div class="row"><span class="label">Type</span><span class="value">${a.type || "N/A"}</span></div>
          <div class="row"><span class="label">Department</span><span class="value">${a.department || "N/A"}</span></div>
          <div class="row"><span class="label">Ward</span><span class="value">${a.ward || "N/A"}</span></div>
          <div class="row"><span class="label">Value</span><span class="value">KES ${(a.value || 0).toLocaleString()}</span></div>
          <div class="row"><span class="label">Custodian</span><span class="value">${a.custodian || "Unassigned"}</span></div>
          <div class="row"><span class="label">Location</span><span class="value">${a.location || "N/A"}</span></div>
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
