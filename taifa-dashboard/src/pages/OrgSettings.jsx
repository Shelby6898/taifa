import { useState, useEffect } from "react";
import { api } from "../api";

// Resize an image client-side to a small square logo (no Firebase Storage
// needed - the result is small enough to store directly in the org's
// Firestore document as a base64 data URL).
function resizeImageToDataUrl(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function OrgSettings() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    name: "", locationLabel: "", locationLabelPlural: "",
    unitLabel: "", unitLabelPlural: "",
    locations: "", units: "", logoUrl: ""
  });
  const [logoError, setLogoError] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get("/organizations/mine");
      const data = res.data.data;
      setOrg(data);
      setForm({
        name: data.name || "",
        locationLabel: data.locationLabel || "Location",
        locationLabelPlural: data.locationLabelPlural || "Locations",
        unitLabel: data.unitLabel || "Department",
        unitLabelPlural: data.unitLabelPlural || "Departments",
        locations: (data.locations || []).join(", "),
        units: (data.units || []).join(", "),
        logoUrl: data.logoUrl || ""
      });
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to load organization"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.put("/organizations/mine", {
        name: form.name,
        locationLabel: form.locationLabel,
        locationLabelPlural: form.locationLabelPlural,
        unitLabel: form.unitLabel,
        unitLabelPlural: form.unitLabelPlural,
        locations: form.locations.split(",").map(s => s.trim()).filter(Boolean),
        units: form.units.split(",").map(s => s.trim()).filter(Boolean),
        logoUrl: form.logoUrl
      });
      setMessage("✅ Organization settings updated successfully");
      // Clear org cache so useOrg hook refetches
      window.dispatchEvent(new Event("org-updated"));
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update organization"));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please select an image file");
      return;
    }
    setLogoError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setForm(prev => ({ ...prev, logoUrl: dataUrl }));
    } catch {
      setLogoError("Failed to process image. Try a different file.");
    }
  };

  const handleRemoveLogo = () => {
    setForm(prev => ({ ...prev, logoUrl: "" }));
    setLogoError("");
  };

  if (!["admin", "super-admin"].includes(user.role)) {
    return <p style={{ padding: 20, color: "#dc2626" }}>Access denied.</p>;
  }

  if (loading) return <p style={{ padding: 20 }}>Loading organization settings...</p>;

  return (
    <div style={{ padding: 16, maxWidth: 700 }}>
      <h2 style={{ margin: "0 0 16px" }}>🏢 Organization Settings</h2>

      {message && (
        <p style={{ marginBottom: 16, color: message.startsWith("✅") ? "green" : "#dc2626" }}>
          {message}
        </p>
      )}

      <div style={styles.card}>
        <h3 style={{ margin: "0 0 4px" }}>Branding</h3>
        <p style={styles.hint}>Shown in the sidebar throughout the app. PNG or JPG, automatically resized.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={styles.logoPreview}>
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Organization logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
            ) : (
              <span style={{ fontSize: 24 }}>🏢</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input type="file" accept="image/*" onChange={handleLogoChange} style={{ fontSize: 13 }} />
            {form.logoUrl && (
              <button onClick={handleRemoveLogo} style={styles.removeLogoBtn}>Remove logo</button>
            )}
            {logoError && <span style={{ fontSize: 12, color: "#dc2626" }}>{logoError}</span>}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: "0 0 16px" }}>General</h3>
        <div style={styles.field}>
          <label style={styles.label}>Organization Name</label>
          <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: "0 0 4px" }}>Location Settings</h3>
        <p style={styles.hint}>e.g. "Ward" for county, "Campus" for university, "Branch" for NGO</p>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Singular Label</label>
            <input style={styles.input} value={form.locationLabel} onChange={e => setForm({ ...form, locationLabel: e.target.value })} placeholder="e.g. Ward" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Plural Label</label>
            <input style={styles.input} value={form.locationLabelPlural} onChange={e => setForm({ ...form, locationLabelPlural: e.target.value })} placeholder="e.g. Wards" />
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>{form.locationLabelPlural || "Locations"} (comma-separated)</label>
          <textarea style={styles.textarea} value={form.locations} onChange={e => setForm({ ...form, locations: e.target.value })} placeholder="e.g. North Campus, South Campus, Main Campus" />
          <span style={styles.count}>{form.locations.split(",").filter(s => s.trim()).length} {form.locationLabelPlural || "locations"}</span>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: "0 0 4px" }}>Unit Settings</h3>
        <p style={styles.hint}>e.g. "Department" for county, "Faculty" for university, "Program" for NGO</p>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Singular Label</label>
            <input style={styles.input} value={form.unitLabel} onChange={e => setForm({ ...form, unitLabel: e.target.value })} placeholder="e.g. Department" />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Plural Label</label>
            <input style={styles.input} value={form.unitLabelPlural} onChange={e => setForm({ ...form, unitLabelPlural: e.target.value })} placeholder="e.g. Departments" />
          </div>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>{form.unitLabelPlural || "Units"} (comma-separated)</label>
          <textarea style={styles.textarea} value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} placeholder="e.g. Finance, ICT, Health, Education" />
          <span style={styles.count}>{form.units.split(",").filter(s => s.trim()).length} {form.unitLabelPlural || "units"}</span>
        </div>
      </div>

      <button style={styles.btn} onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "💾 Save Changes"}
      </button>
    </div>
  );
}

const styles = {
  card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 16 },
  field: { marginBottom: 12 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  hint: { fontSize: 13, color: "#64748b", margin: "0 0 16px" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, boxSizing: "border-box", minHeight: 80, resize: "vertical" },
  count: { fontSize: 12, color: "#94a3b8", marginTop: 4, display: "block" },
  btn: { background: "#1e293b", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontWeight: 600, cursor: "pointer", fontSize: 14 },
  logoPreview: { width: 64, height: 64, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  removeLogoBtn: { background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#dc2626", cursor: "pointer", width: "fit-content" }
};
