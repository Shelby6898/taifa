import { useEffect, useState } from "react";
import { api } from "../api";

const TYPES = ["Repair", "Servicing", "Inspection", "Replacement", "Upgrade", "Other"];
const statusColor = (s) => ({ scheduled: "#2563eb", "in-progress": "#d97706", completed: "#16a34a", cancelled: "#dc2626" }[s] || "#6b7280");

export default function Maintenance() {
  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ assetId: "", type: "", description: "", scheduledDate: "", assignedTo: "", cost: "" });

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canEdit = ["admin", "manager"].includes(user.role);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Always load maintenance records
      const m = await api.get("/maintenance");
      setRecords(m.data.data || []);

      // Only load assets if user can create maintenance
      if (canEdit) {
        try {
          const a = await api.get("/assets");
          setAssets(a.data.data || []);
        } catch {
          setAssets([]);
        }
      }
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to load maintenance records"));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.assetId || !form.type || !form.scheduledDate) {
      setMessage("❌ Asset, Type and Scheduled Date are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/maintenance", { ...form, cost: Number(form.cost) || 0 });
      setMessage("✅ Maintenance record created!");
      setForm({ assetId: "", type: "", description: "", scheduledDate: "", assignedTo: "", cost: "" });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to create"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/maintenance/${editRecord.id}`, {
        status: editRecord.status,
        notes: editRecord.notes,
        cost: Number(editRecord.cost) || 0,
        assignedTo: editRecord.assignedTo
      });
      setMessage("✅ Record updated!");
      setEditRecord(null);
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this maintenance record?")) return;
    try {
      await api.delete(`/maintenance/${id}`);
      setMessage("✅ Record deleted.");
      loadAll();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to delete"));
    }
  };

  const filtered = filterStatus === "all" ? records : records.filter(r => r.status === filterStatus);

  const stats = {
    total: records.length,
    scheduled: records.filter(r => r.status === "scheduled").length,
    inProgress: records.filter(r => r.status === "in-progress").length,
    completed: records.filter(r => r.status === "completed").length,
    totalCost: records.reduce((s, r) => s + (r.cost || 0), 0)
  };

  if (loading) return <p style={{ padding: 20 }}>Loading maintenance records...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>🔧 Maintenance</h2>
        {canEdit && (
          <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); }}>
            {showForm ? "Cancel" : "+ Schedule Maintenance"}
          </button>
        )}
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Create Form — only for admin/manager */}
      {showForm && canEdit && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>Schedule Maintenance</h3>
          <select style={styles.input} value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
            <option value="">-- Select Asset *</option>
            {assets.map(a => <option key={a.assetId} value={a.assetId}>{a.name} ({a.assetCode})</option>)}
          </select>
          <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="">-- Maintenance Type *</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea style={{ ...styles.input, height: 80, resize: "vertical" }} placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input style={styles.input} type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} />
          <input style={styles.input} placeholder="Assigned To (technician)" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} />
          <input style={styles.input} placeholder="Estimated Cost (KES)" type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
          <button style={styles.btn} onClick={handleCreate} disabled={submitting}>
            {submitting ? "Saving..." : "Schedule"}
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: stats.total, color: "#06122b" },
          { label: "Scheduled", value: stats.scheduled, color: "#2563eb" },
          { label: "In Progress", value: stats.inProgress, color: "#d97706" },
          { label: "Completed", value: stats.completed, color: "#16a34a" },
          { label: "Total Cost", value: `KES ${stats.totalCost.toLocaleString()}`, color: "#7c3aed" }
        ].map(s => (
          <div key={s.label} style={{ background: s.color, color: "white", borderRadius: 8, padding: "10px 14px", fontSize: 13, minWidth: 80 }}>
            <div style={{ fontWeight: "bold", fontSize: 20 }}>{s.value}</div>
            <div>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {["all", "scheduled", "in-progress", "completed", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{
            padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
            background: filterStatus === s ? "#06122b" : "#e5e7eb",
            color: filterStatus === s ? "white" : "#333"
          }}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Records */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No maintenance records found.</p>
        ) : filtered.map(r => (
          <div key={r.id} style={{ ...styles.card, borderLeft: `4px solid ${statusColor(r.status)}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{r.assetName}</strong>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{r.assetCode}</span>
                <span style={{ ...styles.badge, background: statusColor(r.status) }}>{r.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>🔧 {r.type}</span>
                <span>🏢 {r.department}</span>
                <span>💰 KES {(r.cost || 0).toLocaleString()}</span>
              </div>
              {r.description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>📝 {r.description}</div>}
              {r.assignedTo && <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>👤 {r.assignedTo}</div>}
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>📅 Scheduled: {r.scheduledDate ? new Date(r.scheduledDate).toLocaleDateString() : "-"}</span>
                {r.completedDate && <span>✅ Completed: {new Date(r.completedDate).toLocaleDateString()}</span>}
              </div>
              {r.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>💬 {r.notes}</div>}
            </div>
            {canEdit && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0, flexDirection: "column" }}>
                <button style={styles.editBtn} onClick={() => { setEditRecord({ ...r }); setMessage(""); }}>Update</button>
                {user.role === "admin" && (
                  <button style={styles.deleteBtn} onClick={() => handleDelete(r.id)}>Delete</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editRecord && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>Update Maintenance</h3>
            <p style={{ margin: "4px 0 12px", color: "#6b7280", fontSize: 13 }}>{editRecord.assetName} — {editRecord.type}</p>
            <select style={styles.input} value={editRecord.status} onChange={e => setEditRecord({ ...editRecord, status: e.target.value })}>
              <option value="scheduled">Scheduled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input style={styles.input} placeholder="Assigned To" value={editRecord.assignedTo || ""} onChange={e => setEditRecord({ ...editRecord, assignedTo: e.target.value })} />
            <input style={styles.input} placeholder="Actual Cost (KES)" type="number" value={editRecord.cost || ""} onChange={e => setEditRecord({ ...editRecord, cost: e.target.value })} />
            <textarea style={{ ...styles.input, height: 80, resize: "vertical" }} placeholder="Notes / completion remarks" value={editRecord.notes || ""} onChange={e => setEditRecord({ ...editRecord, notes: e.target.value })} />
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>
                {submitting ? "Saving..." : "Save"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setEditRecord(null)}>Cancel</button>
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
  editBtn: { background: "#2563eb", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  deleteBtn: { background: "#dc2626", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  form: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 500 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }
};
