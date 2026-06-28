import { useEffect, useState } from "react";
import { api } from "../api";

export default function CheckInOut() {
  const [checkedOut, setCheckedOut] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("checkedout");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [co, fl] = await Promise.all([
        api.get("/checkinout/checked-out"),
        api.get("/checkinout/flagged")
      ]);
      setCheckedOut(co.data.data || []);
      setFlagged(fl.data.data || []);
    } catch (err) {
      setMessage("❌ Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (assetId, name) => {
    const condition = window.prompt(`Checking in "${name}". Enter condition (Good/Fair/Poor):`);
    if (condition === null) return;
    try {
      await api.post(`/checkinout/${assetId}/checkin`, { condition, notes: "" });
      setMessage(`✅ "${name}" checked in successfully`);
      loadData();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to check in"));
    }
  };

  const handleUnflag = async (assetId, name) => {
    if (!window.confirm(`Remove missing flag from "${name}"?`)) return;
    try {
      await api.post(`/checkinout/${assetId}/checkin`, { condition: "Found", notes: "Flag cleared" });
      setMessage(`✅ Flag removed from "${name}"`);
      loadData();
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed"));
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 16px" }}>🔄 Check-In / Check-Out</h2>

      {message && <p style={{ color: message.startsWith("✅") ? "green" : "#dc2626", marginBottom: 12 }}>{message}</p>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={{ ...styles.tab, ...(activeTab === "checkedout" ? styles.tabActive : {}) }} onClick={() => setActiveTab("checkedout")}>
          📤 Checked Out ({checkedOut.length})
        </button>
        <button style={{ ...styles.tab, ...(activeTab === "flagged" ? styles.tabActive : {}) }} onClick={() => setActiveTab("flagged")}>
          🚨 Flagged ({flagged.length})
        </button>
      </div>

      {/* Checked Out */}
      {activeTab === "checkedout" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {checkedOut.length === 0 ? <p style={{ color: "#6b7280" }}>No assets currently checked out.</p>
            : checkedOut.map(a => (
              <div key={a.assetId} style={styles.card}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{a.name}</strong>
                    <span style={styles.codeBadge}>{a.assetCode}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>🏢 {a.department}</span>
                    <span>👤 {a.custodian}</span>
                    <span>💰 KES {(a.value || 0).toLocaleString()}</span>
                  </div>
                  {a.checkedOutAt && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      Out since: {new Date(a.checkedOutAt._seconds * 1000).toLocaleString()}
                    </div>
                  )}
                  {a.expectedReturnDate && (
                    <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>
                      Expected return: {new Date(a.expectedReturnDate._seconds * 1000).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button style={styles.checkinBtn} onClick={() => handleCheckIn(a.assetId, a.name)}>
                  ✅ Check In
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Flagged */}
      {activeTab === "flagged" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {flagged.length === 0 ? <p style={{ color: "#6b7280" }}>No flagged assets.</p>
            : flagged.map(a => (
              <div key={a.assetId} style={{ ...styles.card, borderLeft: "4px solid #dc2626" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{a.name}</strong>
                    <span style={styles.codeBadge}>{a.assetCode}</span>
                    {a.flaggedMissing && <span style={{ ...styles.badge, background: "#dc2626" }}>MISSING</span>}
                    {a.flaggedInactive && <span style={{ ...styles.badge, background: "#6b7280" }}>INACTIVE</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>🏢 {a.department}</span>
                    <span>📍 {a.ward}</span>
                  </div>
                  {a.flaggedMissingReason && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 2 }}>Reason: {a.flaggedMissingReason}</div>}
                  {a.flaggedMissingBy && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Flagged by: {a.flaggedMissingBy}</div>}
                </div>
                <button style={styles.clearBtn} onClick={() => handleUnflag(a.assetId, a.name)}>
                  Clear Flag
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  tab: { padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: 13 },
  tabActive: { background: "#06122b", color: "white", border: "1px solid #06122b" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  badge: { color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" },
  codeBadge: { fontSize: 12, color: "#6b7280", background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 },
  checkinBtn: { background: "#16a34a", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, flexShrink: 0 },
  clearBtn: { background: "#6b7280", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, flexShrink: 0 }
};
