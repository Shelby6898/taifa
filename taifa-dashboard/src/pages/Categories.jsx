import { useEffect, useState } from "react";
import { api } from "../api";

const CLASSES = ["CURRENT", "NON_CURRENT"];
const APPRECIATION_TYPES = ["DEPRECIATION", "APPRECIATION"];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [form, setForm] = useState({ name: "", class: "NON_CURRENT", appreciationType: "DEPRECIATION", appreciationRate: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.data);
    } catch (err) {
      setMessage("❌ Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.appreciationRate) {
      setMessage("❌ Name and rate are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/categories", { ...form, appreciationRate: Number(form.appreciationRate) });
      setMessage("✅ Category created!");
      setForm({ name: "", class: "NON_CURRENT", appreciationType: "DEPRECIATION", appreciationRate: "" });
      setShowForm(false);
      loadCategories();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to create"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await api.put(`/categories/${editCat.id}`, {
        name: editCat.name,
        class: editCat.class,
        appreciationType: editCat.appreciationType,
        appreciationRate: Number(editCat.appreciationRate)
      });
      setMessage("✅ Category updated!");
      setEditCat(null);
      loadCategories();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    try {
      await api.delete(`/categories/${id}`);
      setMessage("✅ Category deleted.");
      loadCategories();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to delete"));
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading categories...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>🗂️ Asset Categories</h2>
        <button style={styles.btn} onClick={() => { setShowForm(!showForm); setMessage(""); }}>
          {showForm ? "Cancel" : "+ New Category"}
        </button>
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "#dc2626" }}>{message}</p>}

      {showForm && (
        <div style={styles.form}>
          <h3 style={{ margin: 0 }}>New Category</h3>
          <div style={styles.grid}>
            <input style={styles.input} placeholder="Category Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select style={styles.input} value={form.class} onChange={e => setForm({ ...form, class: e.target.value })}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={styles.input} value={form.appreciationType} onChange={e => setForm({ ...form, appreciationType: e.target.value })}>
              {APPRECIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input style={styles.input} placeholder="Rate % per year *" type="number" value={form.appreciationRate} onChange={e => setForm({ ...form, appreciationRate: e.target.value })} />
          </div>
          <button style={styles.btn} onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating..." : "Create Category"}
          </button>
        </div>
      )}

      {editCat && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ margin: 0 }}>Edit Category</h3>
            <input style={styles.input} placeholder="Name" value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} />
            <select style={styles.input} value={editCat.class} onChange={e => setEditCat({ ...editCat, class: e.target.value })}>
              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={styles.input} value={editCat.appreciationType} onChange={e => setEditCat({ ...editCat, appreciationType: e.target.value })}>
              {APPRECIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input style={styles.input} placeholder="Rate %" type="number" value={editCat.appreciationRate} onChange={e => setEditCat({ ...editCat, appreciationRate: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={styles.btn} onClick={handleUpdate} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button>
              <button style={styles.cancelBtn} onClick={() => setEditCat(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {categories.length === 0 ? <p style={{ color: "#6b7280" }}>No categories yet. Create one to enable dynamic depreciation rates.</p>
          : categories.map(cat => (
            <div key={cat.id} style={styles.card}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{cat.name}</strong>
                  <span style={{ ...styles.badge, background: cat.class === "CURRENT" ? "#2563eb" : "#06122b" }}>{cat.class}</span>
                  <span style={{ ...styles.badge, background: cat.appreciationType === "DEPRECIATION" ? "#dc2626" : "#16a34a" }}>{cat.appreciationType}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>
                  Rate: <strong>{cat.appreciationRate}% / year</strong>
                  {cat.appreciationType === "DEPRECIATION" && cat.appreciationRate > 0 &&
                    <span style={{ color: "#6b7280", marginLeft: 8 }}>
                      (useful life ~{Math.round(100 / cat.appreciationRate)} years)
                    </span>
                  }
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={styles.editBtn} onClick={() => setEditCat({ ...cat })}>Edit</button>
                <button style={styles.deleteBtn} onClick={() => handleDelete(cat.id, cat.name)}>Delete</button>
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
  editBtn: { background: "#2563eb", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  deleteBtn: { background: "#dc2626", color: "white", border: "none", padding: "7px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  form: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }
};
