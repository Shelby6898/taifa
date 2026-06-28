import { useEffect, useState } from "react";
import { api } from "../api";

export default function Disposals() {
  const [disposals, setDisposals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => { loadDisposals(); }, []);

  const loadDisposals = async () => {
    try {
      const res = await api.get("/disposals");
      setDisposals(res.data.data || []);
      setSummary(res.data.summary || null);
    } catch (err) {
      setMessage("❌ Failed to load disposals");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading disposals...</p>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 16px" }}>🗑️ Asset Disposals</h2>

      {message && <p style={{ color: "#dc2626" }}>{message}</p>}

      {/* Summary */}
      {summary && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {[
            { label: "Total Disposed", value: summary.total, color: "#06122b" },
            { label: "Value Disposed", value: `KES ${(summary.totalValueDisposed || 0).toLocaleString()}`, color: "#dc2626" },
            { label: "Total Proceeds", value: `KES ${(summary.totalProceeds || 0).toLocaleString()}`, color: "#16a34a" }
          ].map(s => (
            <div key={s.label} style={{ background: s.color, color: "white", borderRadius: 8, padding: "10px 16px", fontSize: 13 }}>
              <div style={{ fontWeight: "bold", fontSize: 18 }}>{s.value}</div>
              <div>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Disposals List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {disposals.length === 0 ? <p style={{ color: "#6b7280" }}>No disposals recorded yet.</p>
          : disposals.map(d => (
            <div key={d.id} style={styles.card}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{d.assetName}</strong>
                  {d.assetCode && <span style={styles.codeBadge}>{d.assetCode}</span>}
                  <span style={styles.methodBadge}>{d.method?.replace(/_/g, " ")}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{d.reason}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <span>💰 Value at disposal: KES {(d.valueAtDisposal || 0).toLocaleString()}</span>
                  {d.proceedsAmount > 0 && <span style={{ color: "#16a34a" }}>✅ Proceeds: KES {d.proceedsAmount.toLocaleString()}</span>}
                  {d.approvedBy && <span>✔️ Approved by: {d.approvedBy}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  By {d.disposedByName} — {d.disposedAt ? new Date(d.disposedAt._seconds * 1000).toLocaleDateString() : ""}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const styles = {
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  codeBadge: { fontSize: 12, color: "#6b7280", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 },
  methodBadge: { fontSize: 11, color: "white", background: "#7c3aed", padding: "2px 8px", borderRadius: 12, fontWeight: "bold" }
};
