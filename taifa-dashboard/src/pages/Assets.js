import { useEffect, useState } from "react";
import { api } from "../api";
import { QRCodeSVG } from "qrcode.react";

const TYPES = ["ICT Equipment", "Furniture", "Vehicle", "Land", "Building", "Machinery", "Other"];
const DEPARTMENTS = ["Finance", "ICT", "Health", "Education", "Roads", "Water", "Administration", "Revenue", "Agriculture"];
const WARDS = ["Kabuchai", "Bungoma Central", "Bungoma East", "Bungoma North", "Bungoma South", "Bungoma West", "Musikoma", "Chwele", "Malakisi", "Lwandanyi", "Sirisia", "Namwela", "Maliki", "Tongaren", "Ndivisi", "Maeni", "Milima", "Kimilili", "Kibingei", "Kamukuywa", "Bumula", "Butula", "Nzoia", "Khalaba", "Kimaeti", "Mihuu", "Bokoli", "Kanduyi", "Soysambu", "Teso North", "Teso South", "Anyange", "Chakol North", "Chakol South", "Nambale", "Bukhayo North", "Bukhayo Central", "Bukhayo East", "Mt Elgon", "Kapsokwony", "Cheptais", "Kaptama", "Chesikaki", "Elgon"];

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [qrAsset, setQrAsset] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({
    name: "", type: "", ward: "", department: "",
    value: "", assignedTo: "", location: "", acquisitionDate: ""
  });

  const user      = JSON.parse(localStorage.getItem("user") || "{}");
  const canEdit   = ["admin", "manager"].includes(user.role);
  const canView   = user.role === "viewer";
  const isAdmin   = user.role === "admin";
  const isManager = user.role === "manager";

  useEffect(() => { loadAssets(); }, []);

  // Auto-fill department for managers when create form opens
  useEffect(() => {
    if (isManager && user.department) {
      setForm(f => ({ ...f, department: user.department }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  useEffect(() => {
    let list = [...assets];
    if (filterStatus !== "all") list = list.filter(a => a.status === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.assetCode?.toLowerCase().includes(q) ||
        a.department?.toLowerCase().includes(q) ||
        a.ward?.toLowerCase().includes(q) ||
        a.type?.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [assets, search, filterStatus]);

  const loadAssets = async () => {
    try {
      const res = await api.get("/assets?includeDeleted=true");
      setAssets(res.data.data);
    } catch (err) {
      setMessage("❌ Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setForm({
    name: "", type: "", ward: "",
    department: isManager ? user.department : "",
    value: "", assignedTo: "", location: "", acquisitionDate: ""
  });

  const handleCreate = async () => {
    if (!form.name || !form.type || !form.ward || !form.department) {
      setMessage("❌ Name, Type, Ward and Department are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/assets", { ...form, value: Number(form.value) || 0, createdBy: user.name || "admin" });
      setMessage("✅ Asset created successfully!");
      resetForm();
      setShowForm(false);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to create asset"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/assets/${editAsset.assetId}`, { ...editAsset, updatedBy: user.name || "admin" });
      setMessage("✅ Asset updated!");
      setEditAsset(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update asset"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Delete "${asset.name}"?`)) return;
    try {
      await api.delete(`/assets/${asset.assetId}`);
      setMessage("✅ Asset deleted.");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to delete"));
    }
  };

  const handleRestore = async (asset) => {
    try {
      await api.patch(`/assets/${asset.assetId}/restore`);
      setMessage("✅ Asset restored.");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to restore"));
    }
  };

  const downloadQR = (asset) => {
    const svg = document.getElementById(`qr-${asset.assetId}`);
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 380;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 300, 380);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 25, 20, 250, 250);
      ctx.fillStyle = "#06122b";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(asset.name, 150, 295);
      ctx.font = "12px Arial";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(asset.assetCode, 150, 315);
      ctx.fillText(asset.department, 150, 333);
      ctx.fillText(`KES ${(asset.value || 0).toLocaleString()}`, 150, 351);
      const link = document.createElement("a");
      link.download = `${asset.assetCode}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgStr);
  };

  const getQRData = (asset) => {
    return `http://localhost:4000/assets/view/${asset.assetId}`;
  };

  if (loading) return <p style={{ padding: 20 }}>Loading assets...</p>;

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>📦 Assets</h2>
        {canEdit && (
          <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); resetForm(); }}>
            {showForm ? "Cancel" : "+ New Asset"}
          </button>
        )}
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Create Form */}
      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New Asset</h3>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="Asset Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="">-- Type *</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={styles.input} value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })}>
              <option value="">-- Ward *</option>
              {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            {isManager ? (
              <input
                style={{ ...styles.input, background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }}
                value={user.department}
                readOnly
                title="Managers can only create assets in their department"
              />
            ) : (
              <select style={styles.input} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                <option value="">-- Department *</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <input style={styles.input} placeholder="Value (KES)" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            <input style={styles.input} placeholder="Assigned To" value={form.assignedTo}
              onChange={async e => {
                const name = e.target.value;
                setForm(f => ({ ...f, assignedTo: name }));
              }}
              onBlur={async e => {
                const name = e.target.value.trim();
                if (name && isAdmin) {
                  try {
                    const res = await api.get('/users');
                    const users = res.data.data || [];
                    const match = users.find(u => u.name === name);
                    if (match && match.department) {
                      setForm(f => ({ ...f, department: match.department }));
                    }
                  } catch(err) {}
                }
              }}
            />
            <input style={styles.input} placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <input style={styles.input} type="date" value={form.acquisitionDate} onChange={e => setForm({ ...form, acquisitionDate: e.target.value })} />
          </div>
          <button style={styles.btn} onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create Asset"}
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <input style={{ ...styles.input, flex: 1, minWidth: 180 }} placeholder="🔍 Search by name, code, ward..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...styles.input, minWidth: 120 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total",       value: filtered.length,                                                              color: "#06122b" },
          { label: "Active",      value: filtered.filter(a => a.status === "active").length,                           color: "#16a34a" },
          { label: "Deleted",     value: filtered.filter(a => a.status === "deleted").length,                          color: "#dc2626" },
          { label: "Total Value", value: `KES ${filtered.reduce((s, a) => s + (a.value || 0), 0).toLocaleString()}`,   color: "#2563eb" }
        ].map(s => (
          <div key={s.label} style={{ background: s.color, color: "white", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>
            <div style={{ fontWeight: "bold", fontSize: 18 }}>{s.value}</div>
            <div>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Assets List */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No assets found.</p>
        ) : filtered.map(asset => (
          <div key={asset.assetId} style={{
            ...styles.card,
            opacity: asset.status === "deleted" ? 0.6 : 1,
            borderLeft: `4px solid ${asset.status === "deleted" ? "#dc2626" : "#16a34a"}`
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{asset.name}</strong>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{asset.assetCode}</span>
                <span style={{ ...styles.badge, background: asset.status === "deleted" ? "#dc2626" : "#16a34a" }}>
                  {asset.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>🏷️ {asset.type}</span>
                <span>📍 {asset.ward}</span>
                <span>🏢 {asset.department}</span>
                <span>💰 KES {(asset.value || 0).toLocaleString()}</span>
              </div>
              {asset.assignedTo && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>👤 {asset.assignedTo}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.qrBtn} onClick={() => setQrAsset(asset)}>QR</button>
              {canEdit && !canView && asset.status !== "deleted" && (
                <button style={styles.editBtn} onClick={() => { setEditAsset({ ...asset }); setMessage(""); }}>Edit</button>
              )}
              {isAdmin && (asset.status === "deleted"
                ? <button style={styles.restoreBtn} onClick={() => handleRestore(asset)}>Restore</button>
                : <button style={styles.deleteBtn} onClick={() => handleDelete(asset)}>Delete</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editAsset && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>Edit Asset</h3>
            <p style={{ margin: "4px 0 12px", color: "#6b7280", fontSize: 13 }}>{editAsset.assetCode}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={styles.input} placeholder="Name" value={editAsset.name} onChange={e => setEditAsset({ ...editAsset, name: e.target.value })} />
              <select style={styles.input} value={editAsset.type} onChange={e => setEditAsset({ ...editAsset, type: e.target.value })}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={styles.input} value={editAsset.ward} onChange={e => setEditAsset({ ...editAsset, ward: e.target.value })}>
                {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              {isManager ? (
                <input
                  style={{ ...styles.input, background: "#f1f5f9", color: "#64748b", cursor: "not-allowed" }}
                  value={editAsset.department}
                  readOnly
                  title="Managers cannot change asset department"
                />
              ) : (
                <select style={styles.input} value={editAsset.department} onChange={e => setEditAsset({ ...editAsset, department: e.target.value })}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input style={styles.input} placeholder="Value (KES)" type="number" value={editAsset.value} onChange={e => setEditAsset({ ...editAsset, value: Number(e.target.value) })} />
              <input style={styles.input} placeholder="Assigned To" value={editAsset.assignedTo || ""} onChange={e => setEditAsset({ ...editAsset, assignedTo: e.target.value })} />
              <input style={styles.input} placeholder="Location" value={editAsset.location || ""} onChange={e => setEditAsset({ ...editAsset, location: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</button>
              <button style={styles.cancelBtn} onClick={() => setEditAsset(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrAsset && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, alignItems: "center", textAlign: "center" }}>
            <h3 style={{ margin: 0 }}>QR Code</h3>
            <p style={{ margin: "4px 0 16px", color: "#6b7280", fontSize: 13 }}>{qrAsset.name} — {qrAsset.assetCode}</p>
            <div style={{ background: "white", padding: 16, borderRadius: 12, border: "1px solid #e5e7eb", display: "inline-block" }}>
              <QRCodeSVG
                id={`qr-${qrAsset.assetId}`}
                value={getQRData(qrAsset)}
                size={220}
                level="H"
                includeMargin={true}
              />
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: "#374151", display: "flex", flexDirection: "column", gap: 4 }}>
              <span>🏷️ {qrAsset.type}</span>
              <span>🏢 {qrAsset.department} • 📍 {qrAsset.ward}</span>
              <span>💰 KES {(qrAsset.value || 0).toLocaleString()}</span>
              {qrAsset.assignedTo && <span>👤 {qrAsset.assignedTo}</span>}
              {qrAsset.location && <span>📌 {qrAsset.location}</span>}
            </div>
            <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
              Scan this QR code to view asset details
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
              <button style={styles.btn} onClick={() => downloadQR(qrAsset)}>⬇️ Download PNG</button>
              <button style={styles.cancelBtn} onClick={() => setQrAsset(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  btn:        { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  cancelBtn:  { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  editBtn:    { background: "#2563eb", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  deleteBtn:  { background: "#dc2626", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  restoreBtn: { background: "#16a34a", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  qrBtn:      { background: "#7c3aed", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: "bold" },
  form:       { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 12 },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 },
  input:      { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card:       { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge:      { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  overlay:    { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal:      { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }
};
