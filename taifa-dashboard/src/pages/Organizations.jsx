import { useEffect, useState } from "react";
import { api } from "../api";

export default function Organizations() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "", type: "other",
    locationLabel: "Location", unitLabel: "Department",
    locations: "", units: "",
    adminName: "", adminEmail: "", adminPassword: ""
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get("/organizations");
      setOrgs(res.data.data);
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to load organizations"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.adminName || !form.adminEmail || !form.adminPassword) {
      setMessage("❌ Organization name and admin details are required");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await api.post("/organizations", {
        ...form,
        locationLabelPlural: form.locationLabel + "s",
        unitLabelPlural: form.unitLabel + "s",
        locations: form.locations.split(",").map(s => s.trim()).filter(Boolean),
        units: form.units.split(",").map(s => s.trim()).filter(Boolean)
      });
      setMessage("✅ Organization created successfully");
      setForm({ name: "", type: "other", locationLabel: "Location", unitLabel: "Department", locations: "", units: "", adminName: "", adminEmail: "", adminPassword: "" });
      setShowForm(false);
      load();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to create organization"));
    } finally {
      setSubmitting(false);
    }
  };

  if (user.role !== "super-admin") {
    return <p style={{ padding: 20, color: "#dc2626" }}>Access denied. This page is for super-admins only.</p>;
  }

  if (loading) return <p style={{ padding: 20 }}>Loading organizations...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>🏢 Organizations</h2>
        <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); }}>
          {showForm ? "Cancel" : "+ New Organization"}
        </button>
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New Organization</h3>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="Organization Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="county">County Government</option>
              <option value="university">University / College</option>
              <option value="ngo">NGO</option>
              <option value="hospital">Hospital</option>
              <option value="company">Private Company</option>
              <option value="other">Other</option>
            </select>
            <input style={styles.input} placeholder="Location term (e.g. Ward, Campus, Branch) *" value={form.locationLabel} onChange={e => setForm({ ...form, locationLabel: e.target.value })} />
            <input style={styles.input} placeholder="Unit term (e.g. Department, Faculty) *" value={form.unitLabel} onChange={e => setForm({ ...form, unitLabel: e.target.value })} />
          </div>
          <textarea style={styles.textarea} placeholder="Locations, comma-separated (e.g. North Campus, South Campus)" value={form.locations} onChange={e => setForm({ ...form, locations: e.target.value })} />
          <textarea style={styles.textarea} placeholder="Units, comma-separated (e.g. Finance, IT, HR)" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} />

          <h4 style={{ margin: "4px 0" }}>First Admin Account</h4>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="Admin Name *" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
            <input style={styles.input} placeholder="Admin Email *" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} />
            <input style={styles.input} type="password" placeholder="Admin Password *" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.btn} onClick={handleCreate} disabled={submitting}>
              {submitting ? "Creating..." : "Create Organization"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {orgs.map(org => (
          <div key={org.id} style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{org.name}</h3>
              <span style={styles.badge}>{org.type}</span>
            </div>
            <p style={{ margin: "8px 0 0", color: "#64748b", fontSize: 13 }}>
              {org.locationLabelPlural || "Locations"}: {(org.locations || []).length} • {org.unitLabelPlural || "Units"}: {(org.units || []).length}
            </p>
          </div>
        ))}
        {orgs.length === 0 && <p style={{ color: "#64748b" }}>No organizations yet.</p>}
      </div>
    </div>
  );
}

const styles = {
  btn: { background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  form: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 },
  input: { padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box" },
  textarea: { padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box", minHeight: 60, resize: "vertical" },
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 },
  badge: { background: "#eef2ff", color: "#4338ca", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: "capitalize" }
};
