import { useEffect, useState } from "react";
import { api } from "../api";

export default function Transfers() {
  const [transfers, setTransfers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ assetId: "", ward: "", department: "", reason: "", transferredBy: "" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [t, a] = await Promise.all([
        api.get("/transfers"),
        api.get("/assets")
      ]);
      setTransfers(t.data.data);
      setAssets(a.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.assetId || !form.ward || !form.department) {
      setMessage("Asset, Ward and Department are required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/transfers", form);
      setMessage("✅ Transfer successful!");
      setForm({ assetId: "", ward: "", department: "", reason: "", transferredBy: "" });
      setShowForm(false);
      loadAll();
    } catch (err) {
      setMessage("❌ Transfer failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading transfers...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>🔄 Transfers</h2>
        <button onClick={() => setShowForm(!showForm)} style={styles.btn}>
          {showForm ? "Cancel" : "+ New Transfer"}
        </button>
      </div>

      {message && <p style={{ marginTop: 10, color: message.startsWith("✅") ? "green" : "red" }}>{message}</p>}

      {showForm && (
        <div style={styles.form}>
          <h3 style={{ marginTop: 0 }}>Transfer Asset</h3>
          <select style={styles.input} value={form.assetId} onChange={e => setForm({ ...form, assetId: e.target.value })}>
            <option value="">-- Select Asset --</option>
            {assets.map(a => (
              <option key={a.assetId} value={a.assetId}>{a.name} ({a.assetCode})</option>
            ))}
          </select>
          <input style={styles.input} placeholder="New Ward" value={form.ward} onChange={e => setForm({ ...form, ward: e.target.value })} />
          <input style={styles.input} placeholder="New Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
          <input style={styles.input} placeholder="Reason (optional)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <input style={styles.input} placeholder="Transferred By (optional)" value={form.transferredBy} onChange={e => setForm({ ...form, transferredBy: e.target.value })} />
          <button style={styles.btn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Transfer"}
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: 20 }}>
        <table style={styles.table}>
          <thead style={{ background: "#06122b", color: "white" }}>
            <tr>
              <th style={styles.th}>Asset</th>
              <th style={styles.th}>From Ward</th>
              <th style={styles.th}>To Ward</th>
              <th style={styles.th}>From Dept</th>
              <th style={styles.th}>To Dept</th>
              <th style={styles.th}>Reason</th>
              <th style={styles.th}>By</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: 20 }}>No transfers yet</td></tr>
            ) : transfers.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={styles.td}>{t.assetName}</td>
                <td style={styles.td}>{t.oldData?.ward}</td>
                <td style={styles.td}>{t.newData?.ward}</td>
                <td style={styles.td}>{t.oldData?.department}</td>
                <td style={styles.td}>{t.newData?.department}</td>
                <td style={styles.td}>{t.reason}</td>
                <td style={styles.td}>{t.changedBy}</td>
                <td style={styles.td}>{t.timestamp ? new Date(t.timestamp).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  btn: { background: "#06122b", color: "white", border: "none", padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  form: { background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 },
  input: { padding: "10px", borderRadius: 6, border: "1px solid #ccc", fontSize: 14, width: "100%", boxSizing: "border-box" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 600 },
  th: { padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 14 }
};
