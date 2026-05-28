import { useEffect, useState } from "react";
import { api } from "../api";

const ROLES = ["admin", "manager", "viewer"];
const DEPARTMENTS = ["Finance", "ICT", "Health", "Education", "Roads", "Water", "Administration"];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "viewer", department: "" });
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
      setForm({ name: "", email: "", password: "", role: "viewer", department: "" });
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

  const handleDelete = async (id, email) => {
    if (email === currentUser.email) {
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

  const roleColor = (role) => {
    const map = { admin: "#06122b", manager: "#2563eb", viewer: "#6b7280" };
    return map[role] || "#6b7280";
  };

  if (loading) return <p style={{ padding: 20 }}>Loading users...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>👥 User Management</h2>
        <button onClick={() => { setShowForm(!showForm); setMessage(""); }} style={styles.btn}>
          {showForm ? "Cancel" : "+ Add User"}
        </button>
      </div>

      {message && (
        <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>
          {message}
        </p>
      )}

      {/* Create User Form */}
      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New User</h3>
          <input style={styles.input} placeholder="Full Name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <input style={styles.input} placeholder="Email" type="email" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={styles.input} placeholder="Password" type="password" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <select style={styles.input} value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select style={styles.input} value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}>
            <option value="">-- Department (optional) --</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
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
            <select style={styles.input} value={editUser.role}
              onChange={e => setEditUser({ ...editUser, role: e.target.value })}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select style={styles.input} value={editUser.department || ""}
              onChange={e => setEditUser({ ...editUser, department: e.target.value })}>
              <option value="">-- Department --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
              <button style={styles.cancelBtn} onClick={() => setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {users.length === 0 ? (
          <p>No users found.</p>
        ) : users.map(u => (
          <div key={u.id} style={styles.card}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <strong>{u.name}</strong>
                <span style={{ ...styles.badge, background: roleColor(u.role) }}>{u.role}</span>
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{u.email}</div>
              {u.department && <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>📁 {u.department}</div>}
              {u.createdAt && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Joined {new Date(u.createdAt).toLocaleDateString()}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button style={styles.editBtn} onClick={() => { setEditUser({ ...u }); setMessage(""); }}>Edit</button>
              {u.email !== currentUser.email && (
                <button style={styles.deleteBtn} onClick={() => handleDelete(u.id, u.email)}>Delete</button>
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
  form: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }
};
