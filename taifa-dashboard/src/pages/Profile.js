import { useEffect, useState } from "react";
import { api } from "../api";

const roleColors = { admin: "#06122b", manager: "#2563eb", viewer: "#6b7280" };
const roleLabel = { admin: "Administrator", manager: "Manager", viewer: "Viewer" };

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", jobTitle: "", employeeNumber: "" });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPwForm, setShowPwForm] = useState(false);
  const [message, setMessage] = useState("");
  const [pwMessage, setPwMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await api.get("/auth/profile");
      setProfile(res.data.data);
      setForm({
        name: res.data.data.name || "",
        email: res.data.data.email || "",
        phone: res.data.data.phone || "",
        jobTitle: res.data.data.jobTitle || "",
        employeeNumber: res.data.data.employeeNumber || ""
      });
    } catch (err) {
      setMessage("❌ Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!form.name || !form.email) {
      setMessage("❌ Name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/auth/profile/expanded", form);
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...user, name: form.name }));
      setMessage("✅ Profile updated successfully!");
      setEditMode(false);
      loadProfile();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      setPwMessage("❌ All fields are required.");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMessage("❌ New passwords do not match.");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMessage("❌ Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await api.put("/auth/profile/password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword
      });
      setPwMessage("✅ Password changed successfully!");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPwForm(false);
    } catch (err) {
      setPwMessage("❌ " + (err.response?.data?.message || "Failed to change password"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading profile...</p>;

  return (
    <div style={{ padding: 16, maxWidth: 520 }}>
      <h2 style={{ margin: "0 0 16px" }}>👤 My Profile</h2>

      {message && <p style={{ color: message.startsWith("✅") ? "green" : "#dc2626", marginBottom: 12 }}>{message}</p>}

      {/* Profile Card */}
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={styles.avatar}>
            {profile?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{profile?.name}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{profile?.email}</div>
            <span style={{ ...styles.badge, background: roleColors[profile?.role] || "#6b7280" }}>
              {roleLabel[profile?.role] || profile?.role}
            </span>
          </div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Department</span><span>{profile?.department || "—"}</span></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Job Title</span><span>{profile?.jobTitle || "—"}</span></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Employee No.</span><span>{profile?.employeeNumber || "—"}</span></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Phone</span><span>{profile?.phone || "—"}</span></div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Status</span>
            <span style={{ color: profile?.userStatus === "active" ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
              {profile?.userStatus || "active"}
            </span>
          </div>
          <div style={styles.infoItem}><span style={styles.infoLabel}>Last Login</span>
            <span style={{ fontSize: 12 }}>{profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button style={styles.btn} onClick={() => { setEditMode(!editMode); setMessage(""); }}>
            {editMode ? "Cancel" : "✏️ Edit Profile"}
          </button>
          <button style={styles.outlineBtn} onClick={() => setShowPwForm(!showPwForm)}>
            🔑 Change Password
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editMode && (
        <div style={styles.card}>
          <h3 style={{ margin: "0 0 12px" }}>Edit Profile</h3>
          <div style={styles.formGrid}>
            <input style={styles.input} placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input style={styles.input} placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input style={styles.input} placeholder="Phone (e.g. 0712345678)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input style={styles.input} placeholder="Job Title" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            <input style={styles.input} placeholder="Employee Number" value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
          </div>
          <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Change Password */}
      {showPwForm && (
        <div style={styles.card}>
          <h3 style={{ margin: "0 0 12px" }}>Change Password</h3>
          {pwMessage && <p style={{ color: pwMessage.startsWith("✅") ? "green" : "#dc2626", fontSize: 14 }}>{pwMessage}</p>}
          <div style={styles.formGrid}>
            <input style={styles.input} type="password" placeholder="Current Password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
            <input style={styles.input} type="password" placeholder="New Password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
            <input style={styles.input} type="password" placeholder="Confirm New Password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
          </div>
          <button style={styles.btn} onClick={handlePasswordChange} disabled={submitting}>
            {submitting ? "Changing..." : "Change Password"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 20, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  avatar: { width: 56, height: 56, borderRadius: "50%", background: "#06122b", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold", flexShrink: 0 },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold", display: "inline-block", marginTop: 4 },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  infoItem: { display: "flex", flexDirection: "column", gap: 2 },
  infoLabel: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase", fontWeight: 600 },
  formGrid: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14 },
  btn: { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  outlineBtn: { background: "white", color: "#06122b", border: "1px solid #06122b", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 }
};
