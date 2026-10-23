import { useEffect, useState } from "react";
import useOrg from "../hooks/useOrg";
import { api } from "../api";
import { QRCodeSVG } from "qrcode.react";

const TYPES = ["ICT Equipment", "Furniture", "Vehicle", "Land", "Building", "Machinery", "Other"];


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
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [form, setForm] = useState({
    name: "", type: "", ward: "", department: "",
    value: "", custodian: "", location: "", acquisitionDate: ""
  });
  // activeAssetMenu reserved for future dropdown menu
  const [custodyModal, setCustodyModal] = useState(null);
  const [valuationModal, setValuationModal] = useState(null);
  const [disposalModal, setDisposalModal] = useState(null);
  const [reallocateModal, setReallocateModal] = useState(null);
  // documentModal reserved for document upload feature
  const [custodyLog, setCustodyLog] = useState([]);
  const [users, setUsers] = useState([]);
  const [custodyLogModal, setCustodyLogModal] = useState(null);

  const user      = JSON.parse(localStorage.getItem("user") || "{}");
  const { org }   = useOrg();
  const WARDS      = org?.locations || [];
  const DEPARTMENTS = org?.units || [];
  const locationLabel = org?.locationLabel || "Location";
  const unitLabel     = org?.unitLabel || "Department";
  const canEdit   = ["admin", "manager"].includes(user.role);
  const canView   = user.role === "viewer";
  const isAdmin   = user.role === "admin";
  const isManager = user.role === "manager";

  useEffect(() => { loadAssets(); loadUsers(); }, []);

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

  const loadUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data.data || []);
    } catch (err) {}
  };

  // eslint-disable-next-line no-unused-vars
  const handleAssignCustodian = async (assetId, custodianId, custodianName, purpose) => {
    try {
      await api.post(`/assets/${assetId}/custodian`, { custodianId, custodianName, purpose });
      setMessage("✅ Custodian assigned successfully");
      setCustodyModal(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to assign custodian"));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleReleaseCustodian = async (assetId) => {
    if (!window.confirm("Release custodian from this asset?")) return;
    try {
      await api.delete(`/assets/${assetId}/custodian`);
      setMessage("✅ Custodian released");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  const handleValuation = async (assetId, value, reason, type, notes) => {
    try {
      await api.post(`/depreciation/${assetId}/valuations`, { value, valuationReason: reason, appreciationType: type, notes });
      setMessage("✅ Valuation recorded");
      setValuationModal(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  const handleDispose = async (assetId, method, reason, proceeds, approvedBy) => {
    try {
      await api.post(`/disposals/${assetId}/dispose`, { method, reason, proceedsAmount: proceeds, approvedBy });
      setMessage("✅ Asset disposed successfully");
      setDisposalModal(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };


  const handleDeactivate = async (assetId, name) => {
    const reason = window.prompt(`Deactivating "${name}". Enter reason:`);
    if (!reason) return;
    try {
      await api.post(`/assets/${assetId}/deactivate`, { reason });
      setMessage("✅ Asset deactivated");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to deactivate"));
    }
  };

  const handleActivate = async (assetId, name) => {
    if (!window.confirm(`Reactivate "${name}"?`)) return;
    try {
      await api.post(`/assets/${assetId}/activate`);
      setMessage("✅ Asset reactivated");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to activate"));
    }
  };

  const handleReallocate = async (assetId, newCustodianId, newCustodianName, reason) => {
    try {
      await api.post(`/assets/${assetId}/reallocate`, { newCustodianId, newCustodianName, reason });
      setMessage("✅ Asset reallocated successfully");
      setReallocateModal(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to reallocate"));
    }
  };

  const handleCheckOut = async (assetId, custodianId, custodianName, expectedReturnDate, purpose) => {
    try {
      await api.post(`/checkinout/${assetId}/checkout`, { custodianId, custodianName, expectedReturnDate, purpose });
      setMessage("✅ Asset checked out");
      setCustodyModal(null);
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  const handleCheckIn = async (assetId) => {
    const condition = window.prompt("Enter return condition (Good/Fair/Poor):");
    if (condition === null) return;
    try {
      await api.post(`/checkinout/${assetId}/checkin`, { condition });
      setMessage("✅ Asset checked in");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleFlagMissing = async (assetId) => {
    const reason = window.prompt("Reason for flagging as missing:");
    if (!reason) return;
    try {
      await api.post(`/checkinout/${assetId}/flag-missing`, { reason });
      setMessage("✅ Asset flagged as missing");
      loadAssets();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  const loadCustodyLog = async (asset) => {
    try {
      const res = await api.get(`/assets/${asset.assetId}/custody-log`);
      setCustodyLog(res.data.data || []);
      setCustodyLogModal(asset);
    } catch (err) {
      setMessage("❌ Failed to load custody log");
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/assets/bulk-import/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "asset_import_template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setMessage("❌ Failed to download template");
    }
  };

  const handleBulkImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await api.post("/assets/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setImportResult(res.data);
      loadAssets();
    } catch (err) {
      setImportResult({ success: false, message: err.response?.data?.message || "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => setForm({
    name: "", type: "", ward: "",
    department: isManager ? user.department : "",
    value: "", custodian: "", location: "", acquisitionDate: ""
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


  // eslint-disable-next-line no-unused-vars
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
    return `${process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace("/api","") : "https://taifatech.org"}/assets/view/${asset.assetId}`;
  };

  if (loading) return <p style={{ padding: 20 }}>Loading assets...</p>;

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>📦 Assets</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isAdmin && (
            <button style={styles.cancelBtn} onClick={() => { setShowBulkImport(!showBulkImport); setImportResult(null); setImportFile(null); }}>
              {showBulkImport ? "Cancel Import" : "📥 Bulk Import"}
            </button>
          )}
          {canEdit && (
            <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); resetForm(); }}>
              {showForm ? "Cancel" : "+ New Asset"}
            </button>
          )}
        </div>
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Bulk Import Panel */}
      {showBulkImport && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>📥 Bulk Import Assets</h3>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Download the template, fill in your asset details, then upload the completed file.
            Required columns: <strong>type, name, ward, department</strong>.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <button style={styles.cancelBtn} onClick={downloadTemplate}>⬇️ Download Template</button>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={e => { setImportFile(e.target.files[0]); setImportResult(null); }}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.btn} onClick={handleBulkImport} disabled={!importFile || importing}>
              {importing ? "Importing..." : "Upload & Import"}
            </button>
          </div>
          {importResult && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: importResult.success ? "#f0fdf4" : "#fef2f2", border: `1px solid ${importResult.success ? "#86efac" : "#fca5a5"}` }}>
              <p style={{ margin: 0, fontWeight: 600, color: importResult.success ? "#15803d" : "#dc2626" }}>{importResult.message}</p>
              {importResult.errors && importResult.errors.length > 0 && (
                <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20, fontSize: 13, color: "#991b1b" }}>
                  {importResult.errors.slice(0, 10).map((e, idx) => (
                    <li key={idx}>Row {e.row}: {e.message}</li>
                  ))}
                  {importResult.errors.length > 10 && <li>...and {importResult.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

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
              <option value="">-- {locationLabel} *</option>
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
                <option value="">-- {unitLabel} *</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <input style={styles.input} placeholder="Value (KES)" type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
            <input style={styles.input} placeholder="Custodian" value={form.custodian}
              onChange={async e => {
                const name = e.target.value;
                setForm(f => ({ ...f, custodian: name }));
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
          <option value="ASSIGNED">Assigned</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="NEW">New</option>
          <option value="MAINTENANCE">Maintenance</option>
          <option value="DISPOSED">Disposed</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total",       value: filtered.length,                                                              color: "#06122b" },
          { label: "Assigned", value: filtered.filter(a => a.status === "ASSIGNED").length,                           color: "#16a34a" },
          { label: "Disposed", value: filtered.filter(a => a.status === "DISPOSED").length, color: "#dc2626" },
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
            opacity: asset.status === "DISPOSED" ? 0.6 : 1,
            borderLeft: `4px solid ${asset.status === "DISPOSED" ? "#dc2626" : asset.status === "ASSIGNED" ? "#16a34a" : asset.status === "MAINTENANCE" ? "#f59e0b" : "#6b7280"}`
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{asset.name}</strong>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{asset.assetCode}</span>
                <span style={{ ...styles.badge, background: asset.status === "DISPOSED" ? "#dc2626" : asset.status === "ASSIGNED" ? "#16a34a" : asset.status === "MAINTENANCE" ? "#f59e0b" : "#6b7280" }}>
                  {asset.status}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>🏷️ {asset.type}</span>
                <span>📍 {asset.ward}</span>
                <span>🏢 {asset.department}</span>
                <span>💰 KES {(asset.value || 0).toLocaleString()}</span>
              </div>
              {asset.custodian && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>👤 {asset.custodian}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.qrBtn} onClick={() => setQrAsset(asset)}>QR</button>
              <button style={styles.logBtn} onClick={() => loadCustodyLog(asset)}>📋 Log</button>
              {canEdit && !canView && asset.status !== "DISPOSED" && (
                <button style={styles.editBtn} onClick={() => { setEditAsset({ ...asset }); setMessage(""); }}>Edit</button>
              )}
              {canEdit && asset.status !== "DISPOSED" && (
                asset.checkedOut
                  ? <button style={styles.checkinBtn} onClick={() => handleCheckIn(asset.assetId)}>✅ In</button>
                  : <button style={styles.checkoutBtn} onClick={() => setCustodyModal({ asset, mode: "checkout" })}>📤 Out</button>
              )}
              {isAdmin && asset.status !== "DISPOSED" && (
                <>
                  <button style={styles.valuationBtn} onClick={() => setValuationModal(asset)}>💰 Value</button>
                  <button style={styles.disposalBtn} onClick={() => setDisposalModal(asset)}>🗑️ Dispose</button>
                </>
              )}
              {isAdmin && asset.status !== "DISPOSED" && asset.status !== "DEACTIVATED" && (
                <button style={styles.deactivateBtn} onClick={() => handleDeactivate(asset.assetId, asset.name)}>⏸️ Deactivate</button>
              )}
              {isAdmin && asset.status === "DEACTIVATED" && (
                <button style={styles.activateBtn} onClick={() => handleActivate(asset.assetId, asset.name)}>▶️ Activate</button>
              )}
              {(isAdmin || isManager) && asset.custodian && asset.status !== "DISPOSED" && (
                <button style={styles.reallocateBtn} onClick={() => setReallocateModal(asset)}>🔁 Reallocate</button>
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
              <input style={styles.input} placeholder="Custodian" value={editAsset.custodian || ""} onChange={e => setEditAsset({ ...editAsset, custodian: e.target.value })} />
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
              {qrAsset.custodian && <span>👤 {qrAsset.custodian}</span>}
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

      {/* Custody Log Modal */}
      {custodyLogModal && (
        <div style={styles.overlay}>
          <div style={{ ...styles.modal, maxWidth: 500 }}>
            <h3 style={{ margin: 0 }}>📋 Custody Log — {custodyLogModal.name}</h3>
            <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {custodyLog.length === 0 ? <p style={{ color: "#6b7280" }}>No custody records yet.</p>
                : custodyLog.map(log => (
                  <div key={log.id} style={{ background: "#f9fafb", borderRadius: 6, padding: 10, fontSize: 13 }}>
                    <div><strong>👤 {log.custodianName}</strong></div>
                    <div style={{ color: "#6b7280" }}>From: {log.startDate ? new Date(log.startDate._seconds * 1000).toLocaleDateString() : "—"}</div>
                    <div style={{ color: log.endDate ? "#6b7280" : "#16a34a" }}>To: {log.endDate ? new Date(log.endDate._seconds * 1000).toLocaleDateString() : "Current"}</div>
                    {log.purpose && <div style={{ color: "#374151" }}>Purpose: {log.purpose}</div>}
                  </div>
                ))}
            </div>
            <button style={styles.cancelBtn} onClick={() => setCustodyLogModal(null)}>Close</button>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {custodyModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>📤 Check Out — {custodyModal.asset.name}</h3>
            <CheckoutForm users={users} onSubmit={(cId, cName, ret, pur) => handleCheckOut(custodyModal.asset.assetId, cId, cName, ret, pur)} onCancel={() => setCustodyModal(null)} />
          </div>
        </div>
      )}

      {/* Valuation Modal */}
      {valuationModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>💰 Valuation — {valuationModal.name}</h3>
            <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#6b7280" }}>Current: KES {(valuationModal.currentValue || valuationModal.value || 0).toLocaleString()}</p>
            <ValuationForm onSubmit={(v, r, t, n) => handleValuation(valuationModal.assetId, v, r, t, n)} onCancel={() => setValuationModal(null)} />
          </div>
        </div>
      )}

      {/* Disposal Modal */}
      {disposalModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>🗑️ Dispose — {disposalModal.name}</h3>
            <DisposalForm onSubmit={(m, r, p, a) => handleDispose(disposalModal.assetId, m, r, p, a)} onCancel={() => setDisposalModal(null)} />
          </div>
        </div>
      )}

      {/* Reallocate Modal */}
      {reallocateModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>🔁 Reallocate — {reallocateModal.name}</h3>
            <p style={{ margin: "4px 0 8px", fontSize: 13, color: "#6b7280" }}>Currently with: <strong>{reallocateModal.custodian}</strong></p>
            <ReallocateForm users={users} onSubmit={(cId, cName, reason) => handleReallocate(reallocateModal.assetId, cId, cName, reason)} onCancel={() => setReallocateModal(null)} />
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
  modal:      { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 },
  logBtn:      { background: "#0d9488", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  checkoutBtn: { background: "#7c3aed", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  checkinBtn:  { background: "#16a34a", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  valuationBtn:{ background: "#2563eb", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  disposalBtn: { background: "#dc2626", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  deactivateBtn: { background: "#f59e0b", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  activateBtn: { background: "#16a34a", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  reallocateBtn: { background: "#0891b2", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
};

function CheckoutForm({ users, onSubmit, onCancel }) {
  const [custodianId, setCustodianId] = useState("");
  const [custodianName, setCustodianName] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [purpose, setPurpose] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <select style={formInput} value={custodianId} onChange={e => {
        const u = users.find(u => u.id === e.target.value);
        setCustodianId(e.target.value);
        setCustodianName(u ? u.name : "");
      }}>
        <option value="">-- Select Custodian *</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>)}
      </select>
      <input style={formInput} type="date" placeholder="Expected Return Date" value={expectedReturnDate} onChange={e => setExpectedReturnDate(e.target.value)} />
      <input style={formInput} placeholder="Purpose" value={purpose} onChange={e => setPurpose(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={formBtn} onClick={() => onSubmit(custodianId, custodianName, expectedReturnDate, purpose)} disabled={!custodianId}>Check Out</button>
        <button style={formCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ValuationForm({ onSubmit, onCancel }) {
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("DEPRECIATION");
  const [notes, setNotes] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <input style={formInput} type="number" placeholder="New Value (KES) *" value={value} onChange={e => setValue(e.target.value)} />
      <select style={formInput} value={type} onChange={e => setType(e.target.value)}>
        <option value="DEPRECIATION">DEPRECIATION</option>
        <option value="APPRECIATION">APPRECIATION</option>
      </select>
      <input style={formInput} placeholder="Reason *" value={reason} onChange={e => setReason(e.target.value)} />
      <input style={formInput} placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={formBtn} onClick={() => onSubmit(Number(value), reason, type, notes)} disabled={!value || !reason}>Record Valuation</button>
        <button style={formCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function DisposalForm({ onSubmit, onCancel }) {
  const METHODS = ["TRANSFER","LEASING","TRANSFER_TO_OTHER_AUTHORITY","SALE_BY_TENDER","SALE_BY_PUBLIC_AUCTION","TRADE_IN","BURNING","DESTRUCTION","CANCELLATION"];
  const [method, setMethod] = useState("");
  const [reason, setReason] = useState("");
  const [proceeds, setProceeds] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <select style={formInput} value={method} onChange={e => setMethod(e.target.value)}>
        <option value="">-- Disposal Method *</option>
        {METHODS.map(m => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
      </select>
      <input style={formInput} placeholder="Reason *" value={reason} onChange={e => setReason(e.target.value)} />
      <input style={formInput} type="number" placeholder="Proceeds Amount (KES)" value={proceeds} onChange={e => setProceeds(e.target.value)} />
      <input style={formInput} placeholder="Approved By" value={approvedBy} onChange={e => setApprovedBy(e.target.value)} />
      <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, padding: 10, fontSize: 12, color: "#dc2626" }}>
        ⚠️ This action is permanent and cannot be undone.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={{ ...formBtn, background: "#dc2626" }} onClick={() => onSubmit(method, reason, proceeds, approvedBy)} disabled={!method || !reason}>Confirm Disposal</button>
        <button style={formCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}


function ReallocateForm({ users, onSubmit, onCancel }) {
  const [custodianId, setCustodianId] = useState("");
  const [custodianName, setCustodianName] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
      <select style={formInput} value={custodianId} onChange={e => {
        const u = users.find(u => u.id === e.target.value);
        setCustodianId(e.target.value);
        setCustodianName(u ? u.name : "");
      }}>
        <option value="">-- New Custodian *</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.department || u.role})</option>)}
      </select>
      <input style={formInput} placeholder="Reason for reallocation *" value={reason} onChange={e => setReason(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={formBtn} onClick={() => onSubmit(custodianId, custodianName, reason)} disabled={!custodianId || !reason}>Reallocate</button>
        <button style={formCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const formInput = { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" };
const formBtn = { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 };
const formCancelBtn = { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 };
