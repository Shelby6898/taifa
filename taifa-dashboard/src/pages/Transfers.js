import { useEffect, useState } from "react";
import { api } from "../api";

export default function Transfers() {
  const user        = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin     = user.role === "admin";
  const isManager   = user.role === "manager";
  const canCreate   = isAdmin || isManager;

  const [transfers, setTransfers]   = useState([]);
  const [assets, setAssets]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]       = useState("");
  const [denyModal, setDenyModal]   = useState(null);
  const [denyReason, setDenyReason] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Manager form — submit request for approval
  const [reqForm, setReqForm] = useState({ assetId: "", toWard: "", toDepartment: "", reason: "" });

  // Admin form — direct transfer, no approval needed
  const [adminForm, setAdminForm] = useState({ assetId: "", toWard: "", toDepartment: "", reason: "" });

  const WARDS = ["Kabuchai","Bungoma Central","Bungoma East","Bungoma North","Bungoma South","Bungoma West","Musikoma","Chwele","Malakisi","Lwandanyi","Sirisia","Namwela","Maliki","Tongaren","Ndivisi","Maeni","Milima","Kimilili","Kibingei","Kamukuywa","Bumula","Butula","Nzoia","Khalaba","Kimaeti","Mihuu","Bokoli","Kanduyi","Soysambu","Teso North","Teso South","Anyange","Chakol North","Chakol South","Nambale","Bukhayo North","Bukhayo Central","Bukhayo East","Mt Elgon","Kapsokwony","Cheptais","Kaptama","Chesikaki","Elgon"];
  const DEPTS = ["Finance","ICT","Health","Education","Roads","Water","Administration","Revenue","Agriculture"];

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, a] = await Promise.all([
        api.get("/transfers"),
        api.get("/assets")
      ]);
      setTransfers(t.data.data || []);
      setAssets(a.data.data || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "unknown";
      const status = err.response?.status || "no status";
      setMessage("❌ Error " + status + ": " + msg);
    } finally { setLoading(false); }
  }

  // Manager: submit request → goes to pending, admin approves
  async function submitRequest(e) {
    e.preventDefault();
    if (!reqForm.assetId || !reqForm.toWard || !reqForm.toDepartment) {
      return setMessage("❌ Please fill all required fields.");
    }
    setSubmitting(true);
    try {
      await api.post("/transfers", reqForm);
      setMessage("✅ Transfer request submitted. Awaiting admin approval.");
      setReqForm({ assetId: "", toWard: "", toDepartment: "", reason: "" });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to submit."));
    } finally { setSubmitting(false); }
  }

  // Admin: direct transfer → creates transfer record AND executes immediately
  async function submitDirectTransfer(e) {
    e.preventDefault();
    if (!adminForm.assetId || !adminForm.toWard || !adminForm.toDepartment) {
      return setMessage("❌ Please fill all required fields.");
    }
    setSubmitting(true);
    try {
      // Create transfer record (will be auto-approved)
      await api.post("/transfers/direct", {
        assetId: adminForm.assetId,
        toWard: adminForm.toWard,
        toDepartment: adminForm.toDepartment,
        reason: adminForm.reason
      });
      setMessage("✅ Asset transferred successfully.");
      setAdminForm({ assetId: "", toWard: "", toDepartment: "", reason: "" });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to transfer."));
    } finally { setSubmitting(false); }
  }

  async function approveTransfer(id) {
    try {
      await api.patch(`/transfers/${id}/approve`);
      setMessage("✅ Transfer approved and executed.");
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to approve."));
    }
  }

  async function denyTransfer() {
    if (!denyReason.trim()) return setMessage("❌ Please provide a reason for denial.");
    try {
      await api.patch(`/transfers/${denyModal}/deny`, { reason: denyReason });
      setMessage("Transfer denied.");
      setDenyModal(null);
      setDenyReason("");
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to deny."));
    }
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    let d;
    if (ts._seconds) d = new Date(ts._seconds * 1000);
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  const statusColor = { pending: "#f59e0b", approved: "#10b981", denied: "#ef4444" };
  const filtered = filterStatus === "all" ? transfers : transfers.filter(t => t.status === filterStatus);
  const pendingCount = transfers.filter(t => t.status === "pending").length;

  // Assets available in the form — managers only see their dept
  const availableAssets = assets
    .filter(a => a.status !== "deleted")
    .filter(a => isAdmin || a.department === user.department);

  const s = {
    wrap:    { padding: "20px 16px", fontFamily: "sans-serif" },
    hdr:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 },
    title:   { fontSize: 20, fontWeight: 700, color: "#1e293b" },
    btn:     (c="#1e293b") => ({ padding: "8px 16px", background: c, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }),
    btnSm:   (c="#6366f1") => ({ padding: "5px 12px", background: c+"22", color: c, border: `1px solid ${c}44`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 11 }),
    card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 12 },
    form:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 },
    field:   { marginBottom: 12 },
    label:   { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5, textTransform: "uppercase" },
    input:   { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" },
    grid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    badge:   (c) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: c+"22", color: c, border: `1px solid ${c}44` }),
    msg:     (ok) => ({ background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, color: ok ? "#166534" : "#991b1b", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, display: "flex", justifyContent: "space-between" }),
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    modal:   { background: "#fff", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 },
    note:    { fontSize: 12, color: "#6366f1", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 8, padding: "8px 12px", marginBottom: 14 },
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.hdr}>
        <div>
          <div style={s.title}>
            🔄 Transfers
            {pendingCount > 0 && isAdmin && (
              <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                {pendingCount} pending
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
            {isAdmin ? "Manage all transfers and approve requests" : "Submit and track transfer requests"}
          </div>
        </div>
        {canCreate && (
          <button style={s.btn()} onClick={() => { setShowForm(!showForm); setMessage(""); }}>
            {showForm ? "Cancel" : isAdmin ? "+ Transfer Asset" : "+ New Request"}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={s.msg(message.includes("✅"))}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* ADMIN: Direct Transfer Form */}
      {showForm && isAdmin && (
        <div style={s.form}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>⚡ Direct Transfer</h3>
          <div style={s.note}>Admin transfers execute immediately — no approval required.</div>
          <form onSubmit={submitDirectTransfer}>
            <div style={s.field}>
              <label style={s.label}>Asset *</label>
              <select style={s.input} value={adminForm.assetId}
                onChange={e => setAdminForm({...adminForm, assetId: e.target.value})}>
                <option value="">Select asset</option>
                {availableAssets.map(a => (
                  <option key={a.assetId} value={a.assetId}>
                    {a.name} — {a.department} ({a.ward})
                  </option>
                ))}
              </select>
            </div>
            <div style={s.grid}>
              <div style={s.field}>
                <label style={s.label}>To Ward *</label>
                <select style={s.input} value={adminForm.toWard}
                  onChange={e => setAdminForm({...adminForm, toWard: e.target.value})}>
                  <option value="">Select ward</option>
                  {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>To Department *</label>
                <select style={s.input} value={adminForm.toDepartment}
                  onChange={e => setAdminForm({...adminForm, toDepartment: e.target.value})}>
                  <option value="">Select department</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Reason</label>
              <textarea style={{...s.input, minHeight: 60, resize: "vertical"}}
                placeholder="Reason for transfer (optional)"
                value={adminForm.reason}
                onChange={e => setAdminForm({...adminForm, reason: e.target.value})}/>
            </div>
            <button type="submit" style={s.btn("#10b981")} disabled={submitting}>
              {submitting ? "Transferring…" : "⚡ Execute Transfer"}
            </button>
          </form>
        </div>
      )}

      {/* MANAGER: Submit Request Form */}
      {showForm && isManager && (
        <div style={s.form}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📦 New Transfer Request</h3>
          <div style={{ ...s.note, background: "#fef9c3", border: "1px solid #fde68a", color: "#92400e" }}>
            Your request will be reviewed and approved by an admin.
          </div>
          <form onSubmit={submitRequest}>
            <div style={s.field}>
              <label style={s.label}>Asset *</label>
              <select style={s.input} value={reqForm.assetId}
                onChange={e => setReqForm({...reqForm, assetId: e.target.value})}>
                <option value="">Select asset</option>
                {availableAssets.map(a => (
                  <option key={a.assetId} value={a.assetId}>
                    {a.name} — {a.department} ({a.ward})
                  </option>
                ))}
              </select>
            </div>
            <div style={s.grid}>
              <div style={s.field}>
                <label style={s.label}>To Ward *</label>
                <select style={s.input} value={reqForm.toWard}
                  onChange={e => setReqForm({...reqForm, toWard: e.target.value})}>
                  <option value="">Select ward</option>
                  {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>To Department *</label>
                <select style={s.input} value={reqForm.toDepartment}
                  onChange={e => setReqForm({...reqForm, toDepartment: e.target.value})}>
                  <option value="">Select department</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Reason</label>
              <textarea style={{...s.input, minHeight: 70, resize: "vertical"}}
                placeholder="Why is this transfer needed?"
                value={reqForm.reason}
                onChange={e => setReqForm({...reqForm, reason: e.target.value})}/>
            </div>
            <button type="submit" style={s.btn("#6366f1")} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["all","pending","approved","denied"].map(status => (
          <button key={status} onClick={() => setFilterStatus(status)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 12, textTransform: "capitalize",
              background: filterStatus === status ? "#6366f1" : "#f1f5f9",
              color: filterStatus === status ? "#fff" : "#64748b" }}>
            {status === "all"
              ? `All (${transfers.length})`
              : `${status} (${transfers.filter(t => t.status === status).length})`}
          </button>
        ))}
      </div>

      {/* Transfer Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No transfers found.</div>
      ) : filtered.map(t => (
        <div key={t.id} style={{...s.card, borderLeft: `4px solid ${statusColor[t.status] || "#e2e8f0"}`}}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>
              📦 {t.assetName}
              {t.assetCode && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>({t.assetCode})</span>}
            </div>
            <span style={s.badge(statusColor[t.status] || "#64748b")}>
              {t.status === "pending" ? "⏳ Pending" : t.status === "approved" ? "✅ Approved" : "❌ Denied"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: 6 }}>
              {t.fromDepartment} — {t.fromWard}
            </span>
            <span style={{ color: "#6366f1", fontWeight: 700 }}>→</span>
            <span style={{ background: "#ede9fe", padding: "3px 8px", borderRadius: 6, color: "#6366f1" }}>
              {t.toDepartment} — {t.toWard}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
            📝 {t.reason || "No reason provided"} &nbsp;|&nbsp;
            👤 {t.requestedByName || "—"} &nbsp;|&nbsp;
            📅 {fmtDate(t.createdAt)}
          </div>
          {t.status === "approved" && (
            <div style={{ fontSize: 12, color: "#10b981", marginBottom: 8 }}>
              ✅ Approved by {t.approvedByName} on {fmtDate(t.approvedAt)}
            </div>
          )}
          {t.status === "denied" && (
            <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>
              ❌ Denied by {t.approvedByName}: {t.deniedReason}
            </div>
          )}
          {isAdmin && t.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button style={s.btnSm("#10b981")} onClick={() => approveTransfer(t.id)}>✅ Approve</button>
              <button style={s.btnSm("#ef4444")} onClick={() => { setDenyModal(t.id); setDenyReason(""); }}>❌ Deny</button>
            </div>
          )}
        </div>
      ))}

      {/* Deny Modal */}
      {denyModal && (
        <div style={s.overlay} onClick={() => setDenyModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>❌ Deny Transfer</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
              Please provide a reason for denying this transfer request.
            </p>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              placeholder="Reason for denial…"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "none", minHeight: 80, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn("#ef4444")} onClick={denyTransfer}>Deny Transfer</button>
              <button style={s.btn("#94a3b8")} onClick={() => setDenyModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
