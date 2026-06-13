import { useEffect, useState } from "react";
import { api } from "../api";

const typeIcon = (type) => ({
  transfer_in: "📥", transfer_out: "📤", transfer: "🔄", transfer_request: "🔄",
  transfer_approved: "✅", transfer_denied: "❌",
  maintenance: "🔧", alert: "⚠️",
  asset_created: "🏛️", ticket_new: "🎫", ticket_updated: "🎫"
}[type] || "🔔");
const typeColor = (type) => ({
  transfer_in: "#16a34a", transfer_out: "#dc2626", transfer: "#2563eb",
  transfer_request: "#6366f1", transfer_approved: "#10b981", transfer_denied: "#ef4444",
  maintenance: "#d97706", alert: "#dc2626",
  asset_created: "#6366f1", ticket_new: "#8b5cf6", ticket_updated: "#8b5cf6"
}[type] || "#6b7280");

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.put("/notifications/mark-all/read");
    load();
  };

  const deleteNotif = async (id) => {
    await api.delete(`/notifications/${id}`);
    load();
  };

  const filtered = filter === "all" ? notifications
    : filter === "unread" ? notifications.filter(n => !n.isRead)
    : filter === "ticket" ? notifications.filter(n => n.type?.includes("ticket"))
    : filter === "asset" ? notifications.filter(n => n.type?.includes("asset"))
    : filter === "transfer" ? notifications.filter(n => n.type?.includes("transfer"))
    : notifications.filter(n => n.type?.includes(filter));

  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return <p style={{ padding: 20 }}>Loading notifications...</p>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>🔔 Notifications {unread > 0 && <span style={{ background: "#dc2626", color: "white", fontSize: 12, padding: "2px 8px", borderRadius: 12, marginLeft: 8 }}>{unread} unread</span>}</h2>
        {unread > 0 && <button style={styles.btn} onClick={markAllRead}>Mark all read</button>}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {["all", "unread", "transfer", "maintenance", "ticket", "asset"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "7px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
            background: filter === f ? "#06122b" : "#e5e7eb",
            color: filter === f ? "white" : "#333"
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <p style={{ color: "#6b7280" }}>No notifications found.</p>
        ) : filtered.map(n => (
          <div key={n.id} style={{
            background: n.isRead ? "white" : "#eff6ff",
            border: "1px solid #e5e7eb",
            borderLeft: `4px solid ${typeColor(n.type)}`,
            borderRadius: 8,
            padding: 14,
            display: "flex",
            gap: 12,
            alignItems: "flex-start"
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{typeIcon(n.type)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <strong style={{ fontSize: 14 }}>{n.title}</strong>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#374151" }}>{n.message}</p>
              {n.assetName && (
                <div style={{ marginTop: 6, display: "flex", gap: 12, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                  {n.fromDept && <span>From: <strong>{n.fromDept}</strong></span>}
                  {n.toDept && <span>To: <strong>{n.toDept}</strong></span>}
                  {n.triggeredBy && <span>By: <strong>{n.triggeredBy}</strong></span>}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              {!n.isRead && (
                <button style={styles.readBtn} onClick={() => markRead(n.id)}>Read</button>
              )}
              {(user.role === "admin" || user.role === "super-admin") && (
                <button style={styles.deleteBtn} onClick={() => deleteNotif(n.id)}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  btn: { background: "#06122b", color: "white", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  readBtn: { background: "#2563eb", color: "white", border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  deleteBtn: { background: "#fee2e2", color: "#dc2626", border: "none", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }
};
