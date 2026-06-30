import { useEffect, useState } from "react";
import { api } from "../api";
import useOrg from "../hooks/useOrg";

const ROLES = ["admin", "manager", "viewer"];
const USER_STATUSES = ["active", "inactive", "disabled", "blocked"];

export default function Users() {
  const { org } = useOrg();
  const DEPARTMENTS = org?.units || [];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer", department: "", employeeNumber: "", jobTitle: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data.data);
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setMessage("❌ Name, email and password are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/register", form);
      setMessage("✅ User created successfully!");
      setForm({ name: "", email: "", password: "", role: "viewer", department: "", employeeNumber: "", jobTitle: "", phone: "" });
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to create user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/auth/users/${editUser.id}`, {
        role: editUser.role,
        department: editUser.department
      });
      setMessage("✅ User updated!");
      setEditUser(null);
      loadUsers();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update user"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!window.confirm(`Change user status to "${newStatus}"?`)) return;
    try {
      await api.patch(`/auth/users/${userId}/status`, { userStatus: newStatus });
      setMessage(`✅ User status changed to ${newStatus}`);
      loadUsers();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update status"));
    }
  };

  const handleDelete = async (id, email) => {
    if (id === currentUser.id) {
      setMessage("❌ You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`Delete user ${email}?`)) return;
    try {
      await api.delete(`/auth/users/${id}`);
      setMessage("✅ User deleted.");
      loadUsers();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to delete user"));
    }
  };

  const roleColor = (role) => ({ admin: "#06122b", manager: "#2563eb", viewer: "#6b7280" }[role] || "#6b7280");

  const statusColor = (status) => ({
    active: "#16a34a", inactive: "#f59e0b", disabled: "#6b7280", blocked: "#dc2626"
  }[status] || "#16a34a");

  if (loading) return <p style={{ padding: 20 }}>Loading users...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>👥 User Management</h2>
        <button onClick={() => { setShowForm(!showForm); setMessage(""); }} style={styles.btn}>
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {/* Create User Form */}
      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New User</h3>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input style={styles.input} placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input style={styles.input} placeholder="Password *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            <input style={styles.input} placeholder="Phone (e.g. 0712345678)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <input style={styles.input} placeholder="Job Title" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            <input style={styles.input} placeholder="Employee Number" value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} />
            <select style={styles.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select style={styles.input} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
              <option value="">-- Department (optional) --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <button style={styles.btn} onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create User"}
          </button>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>Edit {editUser.name}</h3>
            <p style={{ margin: "4px 0 12px", color: "#6b7280", fontSize: 13 }}>{editUser.email}</p>
            <select style={styles.input} value={editUser.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select style={styles.input} value={editUser.department || ""} onChange={e => setEditUser({ ...editUser, department: e.target.value })}>
              <option value="">-- Department --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</button>
              <button style={styles.cancelBtn} onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {users.length === 0 ? <p>No users found.</p> : users.map(u => (
          <div key={u.id} style={styles.card}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{u.name}</strong>
                <span style={{ ...styles.badge, background: roleColor(u.role) }}>{u.role}</span>
                <span style={{ ...styles.badge, background: statusColor(u.userStatus || "active") }}>
                  {u.userStatus || "active"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{u.email}</div>
              <div style={{ fontSize: 12, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {u.department && <span>📁 {u.department}</span>}
                {u.jobTitle && <span>💼 {u.jobTitle}</span>}
                {u.employeeNumber && <span>🪪 {u.employeeNumber}</span>}
                {u.phone && <span>📞 {u.phone}</span>}
              </div>
              {u.lastLoginAt && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Last login: {new Date(u.lastLoginAt).toLocaleString()}</div>}
              {u.loginAttempts > 0 && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>⚠️ Failed attempts: {u.loginAttempts}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={styles.editBtn} onClick={() => { setEditUser({ ...u }); setMessage(""); }}>Edit</button>
              {u.id !== currentUser.id && (
                <>
                  <select
                    style={{ ...styles.input, padding: "6px 8px", fontSize: 12, width: "auto" }}
                    value={u.userStatus || "active"}
                    onChange={e => handleStatusChange(u.id, e.target.value)}
                  >
                    {USER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(u.id, u.email)}>Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  btn: { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  cancelBtn: { background: "#e5e7eb", color: "#374151", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  editBtn: { background: "#2563eb", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  deleteBtn: { background: "#dc2626", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  form: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }
};
