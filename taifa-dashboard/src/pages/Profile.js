import { useEffect, useState } from "react";
import { api } from "../api";

const roleColors = { admin: "#06122b", manager: "#2563eb", viewer: "#6b7280" };
const roleLabel = { admin: "Administrator", manager: "Manager", viewer: "Viewer" };

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
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
      setForm({ name: res.data.data.name, email: res.data.data.email });
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
      await api.put("/auth/profile", form);
      // Update localStorage
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

  const initials = profile?.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <div style={{ padding: 16, maxWidth: 500 }}>
      <h2 style={{ margin: 0 }}>👤 My Profile</h2>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Avatar & Role */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, background: "white", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: roleColors[profile?.role] || "#06122b", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 28, fontWeight: "bold", flexShrink: 0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: "bold" }}>{profile?.name}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{profile?.email}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{ background: roleColors[profile?.role], color: "white", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: "bold" }}>
              {roleLabel[profile?.role] || profile?.role}
            </span>
            {profile?.department && (
              <span style={{ background: "#e5e7eb", color: "#374151", fontSize: 11, padding: "3px 10px", borderRadius: 12 }}>
                📁 {profile.department}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div style={{ background: "white", borderRadius: 12, padding: 20, marginTop: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Account Information</h3>
          {!editMode && (
            <button style={styles.editBtn} onClick={() => { setEditMode(true); setMessage(""); }}>Edit</button>
          )}
        </div>

        {editMode ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={styles.label}>Full Name</label>
              <input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Email Address</label>
              <input style={styles.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <button style={styles.cancelBtn} onClick={() => { setEditMode(false); setMessage(""); setForm({ name: profile.name, email: profile.email }); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Full Name", value: profile?.name },
              { label: "Email", value: profile?.email },
              { label: "Role", value: roleLabel[profile?.role] || profile?.role },
              { label: "Department", value: profile?.department || "All Departments" },
              { label: "Member Since", value: profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" }) : "-" }
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: "500", textAlign: "right", maxWidth: "60%" }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Change Password */}
      <div style={{ background: "white", borderRadius: 12, padding: 20, marginTop: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>🔒 Password</h3>
          <button style={styles.editBtn} onClick={() => { setShowPwForm(!showPwForm); setPwMessage(""); }}>
            {showPwForm ? "Cancel" : "Change"}
          </button>
        </div>

        {pwMessage && <p style={{ marginTop: 10, color: pwMessage.startsWith("✅") ? "green" : "#dc2626", fontSize: 13 }}>{pwMessage}</p>}

        {showPwForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            <div>
              <label style={styles.label}>Current Password</label>
              <input style={styles.input} type="password" placeholder="Enter current password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>New Password</label>
              <input style={styles.input} type="password" placeholder="Min. 6 characters" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
            </div>
            <div>
              <label style={styles.label}>Confirm New Password</label>
              <input style={styles.input} type="password" placeholder="Repeat new password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
            </div>
            <button style={styles.btn} onClick={handlePasswordChange} disabled={submitting}>
              {submitting ? "Changing..." : "Change Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  btn: { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  cancelBtn: { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  editBtn: { background: "#e5e7eb", color: "#374151", border: "none", padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box", marginTop: 4 },
  label: { fontSize: 12, color: "#6b7280", fontWeight: "500" }
};
