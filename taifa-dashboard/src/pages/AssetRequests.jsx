import { useEffect, useState } from "react";
import { api } from "../api";
import useOrg from "../hooks/useOrg";

const URGENCY_LEVELS = ["LOW", "NORMAL", "HIGH", "URGENT"];
const URGENCY_COLORS = { LOW: "#6b7280", NORMAL: "#2563eb", HIGH: "#f59e0b", URGENT: "#dc2626" };
const STATUS_COLORS = { PENDING: "#f59e0b", APPROVED: "#16a34a", REJECTED: "#dc2626" };

const ICT_TYPES = [
  "Laptop", "Desktop Computer", "Printer", "Scanner", "Projector",
  "UPS", "Monitor", "Keyboard & Mouse", "Network Switch", "Router",
  "External Hard Drive", "Flash Disk", "Webcam", "Headset", "Other ICT Equipment"
];

export default function AssetRequests() {
  const { org } = useOrg();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isViewer = user.role === "viewer";
  const isManager = user.role === "manager";
  const isAdmin = user.role === "admin";

  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const [form, setForm] = useState({
    assetType: "", description: "", reason: "", urgency: "NORMAL"
  });
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { loadRequests(); loadAssets(); }, []);

  const loadRequests = async () => {
    try {
      const res = await api.get("/asset-requests");
      setRequests(res.data.data || []);
    } catch (err) {
      setMessage("❌ Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const loadAssets = async () => {
    try {
      const res = await api.get("/assets");
      // Only show unassigned or new assets available for assignment
      const available = (res.data.data || []).filter(a =>
        ["UNASSIGNED", "NEW"].includes(a.status)
      );
      setAssets(available);
    } catch (err) {}
  };

  const handleSubmit = async () => {
    if (!form.assetType || !form.description || !form.reason) {
      setMessage("❌ All fields are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/asset-requests", form);
      setMessage("✅ Asset request submitted successfully!");
      setForm({ assetType: "", description: "", reason: "", urgency: "NORMAL" });
      setShowForm(false);
      loadRequests();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to submit"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/asset-requests/${approveModal.id}/approve`, {
        assetId: selectedAssetId || undefined
      });
      setMessage("✅ Request approved successfully!");
      setApproveModal(null);
      setSelectedAssetId("");
      loadRequests();
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to approve"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      setMessage("❌ Please provide a reason for rejection.");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch(`/asset-requests/${rejectModal.id}/reject`, {
        rejectedReason: rejectReason
      });
      setMessage("✅ Request rejected.");
      setRejectModal(null);
      setRejectReason("");
      loadRequests();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to reject"));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filterStatus === "all"
    ? requests
    : requests.filter(r => r.status === filterStatus);

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  if (loading) return <p style={{ padding: 20 }}>Loading requests...</p>;

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0 }}>📋 Asset Requests</h2>
          {pendingCount > 0 && !isViewer && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
              ⚠️ {pendingCount} pending request{pendingCount > 1 ? "s" : ""} awaiting your action{isAdmin ? " (including manager requests)" : ""}
            </p>
          )}
        </div>
        {(isViewer || isManager) && (
          <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); }}>
            {showForm ? "Cancel" : isManager ? "+ Request from Admin" : "+ New Request"}
          </button>
        )}
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Request Form */}
      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New Asset Request</h3>
          <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#6b7280" }}>
            Submit a request for an ICT asset you need for your work.
          </p>
          <select style={styles.input} value={form.assetType} onChange={e => setForm({ ...form, assetType: e.target.value })}>
            <option value="">-- Select Asset Type *</option>
            {ICT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea
            style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
            placeholder="Description — be specific e.g. 'Need a laptop for data entry and report generation' *"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
          />
          <textarea
            style={{ ...styles.input, minHeight: 60, resize: "vertical" }}
            placeholder="Business reason — why do you need this asset? *"
            value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
          />
          <select style={styles.input} value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}>
            {URGENCY_LEVELS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button style={styles.btn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {["all", "PENDING", "APPROVED", "REJECTED"].map(s => (
          <button
            key={s}
            style={{ ...styles.filterBtn, ...(filterStatus === s ? styles.filterBtnActive : {}) }}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "All" : s} {s === "PENDING" && pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {/* Requests List */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
              {filterStatus === "PENDING" ? "No pending requests." : "No requests found."}
            </p>
            {isViewer && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#9ca3af" }}>
                {isViewer ? 'Click "+ New Request" to request an asset from your manager.' : isManager ? 'Click "+ Request from Admin" to request an asset for your department.' : ''}
              </p>
            )}
          </div>
        ) : filtered.map(req => (
          <div key={req.id} style={{ ...styles.card, borderLeft: `4px solid ${STATUS_COLORS[req.status] || "#6b7280"}` }}>
            <div style={{ flex: 1 }}>
              {/* Header row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{req.assetType}</strong>
                <span style={{ ...styles.badge, background: STATUS_COLORS[req.status] }}>{req.status}</span>
                <span style={{ ...styles.badge, background: URGENCY_COLORS[req.urgency] }}>{req.urgency}</span>
              </div>

              {/* Description */}
              <p style={{ margin: "6px 0 4px", fontSize: 13, color: "#374151" }}>{req.description}</p>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>
                <strong>Reason:</strong> {req.reason}
              </p>

              {/* Meta */}
              <div style={{ fontSize: 12, color: "#9ca3af", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>👤 {req.requestedByName}</span>
                <span>🏢 {req.department}</span>
                <span>📅 {req.createdAt ? new Date(req.createdAt._seconds * 1000).toLocaleDateString() : ""}</span>
              </div>

              {/* Approved/Rejected info */}
              {req.status === "APPROVED" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#16a34a" }}>
                  ✅ Approved by {req.approvedByName}
                  {req.assignedAssetName && ` — Asset assigned: ${req.assignedAssetName}`}
                </div>
              )}
              {req.status === "REJECTED" && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>
                  ❌ Rejected by {req.approvedByName} — {req.rejectedReason}
                </div>
              )}
            </div>

            {/* Action buttons for manager/admin */}
            {(isManager || isAdmin) && req.status === "PENDING" && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexDirection: "column" }}>
                <button style={styles.approveBtn} onClick={() => { setApproveModal(req); setSelectedAssetId(""); }}>
                  ✅ Approve
                </button>
                <button style={styles.rejectBtn} onClick={() => { setRejectModal(req); setRejectReason(""); }}>
                  ❌ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>✅ Approve Request</h3>
            <p style={{ margin: "8px 0 4px", fontSize: 13, color: "#374151" }}>
              <strong>{approveModal.requestedByName}</strong> requested: {approveModal.assetType}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6b7280" }}>{approveModal.description}</p>

            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Assign an available asset (optional):
            </label>
            <select style={{ ...styles.input, marginTop: 6 }} value={selectedAssetId} onChange={e => setSelectedAssetId(e.target.value)}>
              <option value="">-- Assign later (approve only)</option>
              {assets.map(a => (
                <option key={a.assetId} value={a.assetId}>
                  {a.name} — {a.assetCode} (KES {(a.value || 0).toLocaleString()})
                </option>
              ))}
            </select>

            {assets.length === 0 && (
              <p style={{ fontSize: 12, color: "#f59e0b", margin: "6px 0" }}>
                ⚠️ No available assets right now. You can approve the request and assign an asset later.
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={styles.approveBtn} onClick={handleApprove} disabled={submitting}>
                {submitting ? "Approving..." : "Confirm Approval"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setApproveModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>❌ Reject Request</h3>
            <p style={{ margin: "8px 0 12px", fontSize: 13, color: "#374151" }}>
              <strong>{rejectModal.requestedByName}</strong> requested: {rejectModal.assetType}
            </p>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Reason for rejection *
            </label>
            <textarea
              style={{ ...styles.input, minHeight: 80, marginTop: 6, resize: "vertical" }}
              placeholder="e.g. No available budget, asset already allocated, request incomplete..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={styles.rejectBtn} onClick={handleReject} disabled={submitting}>
                {submitting ? "Rejecting..." : "Confirm Rejection"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  btn: { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  cancelBtn: { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  approveBtn: { background: "#16a34a", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  rejectBtn: { background: "#dc2626", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  filterBtn: { padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: 13 },
  filterBtnActive: { background: "#06122b", color: "white", border: "1px solid #06122b" },
  form: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  emptyState: { background: "#f9fafb", border: "1px dashed #d1d5db", borderRadius: 8, padding: 24, textAlign: "center" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }
};
