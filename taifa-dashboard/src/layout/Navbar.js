import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { api } from "../api";

export default function Navbar({ onMenuClick }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      const data = res.data.data || [];
      setNotifications(data.slice(0, 10));
      setUnread(data.filter(n => !n.isRead).length);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    setLoading(true);
    try {
      await api.put("/notifications/mark-all/read");
      await loadNotifications();
    } catch {} finally { setLoading(false); }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      await loadNotifications();
    } catch {}
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const initials = user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const typeIcon = (type) => ({ transfer_in: "📥", transfer_out: "📤", transfer: "🔄", maintenance: "🔧", alert: "⚠️" }[type] || "🔔");
  const typeColor = (type) => ({ transfer_in: "#16a34a", transfer_out: "#dc2626", transfer: "#2563eb", maintenance: "#d97706" }[type] || "#6b7280");

  return (
    <>
      <div style={styles.nav}>
        <button onClick={onMenuClick} style={styles.menuBtn}>☰</button>
        <h3 style={styles.title}>County Asset Management System</h3>
        <div style={styles.right}>

          {/* Bell */}
          <div style={{ position: "relative" }}>
            <button style={styles.bellBtn} onClick={() => { setShowPanel(!showPanel); setShowUserMenu(false); }}>
              🔔
              {unread > 0 && <span style={styles.badge}>{unread > 9 ? "9+" : unread}</span>}
            </button>
          </div>

          {/* Avatar / User Menu */}
          <div style={{ position: "relative" }}>
            <button style={styles.avatarBtn} onClick={() => { setShowUserMenu(!showUserMenu); setShowPanel(false); }}>
              {initials}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications Panel */}
      {showPanel && (
        <>
          <div style={styles.overlay} onClick={() => setShowPanel(false)} />
          <div style={{ ...styles.panel, right: 60 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ margin: 0 }}>🔔 Notifications</h4>
              {unread > 0 && <button style={styles.markAllBtn} onClick={handleMarkAllRead} disabled={loading}>{loading ? "..." : "Mark all read"}</button>}
            </div>
            {notifications.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No notifications yet</p>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => handleMarkRead(n.id)} style={{ ...styles.notifItem, background: n.isRead ? "white" : "#eff6ff", borderLeft: `3px solid ${typeColor(n.type)}` }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18 }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.isRead ? "normal" : "bold" }}>{n.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                  </div>
                  {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", flexShrink: 0, marginTop: 4 }} />}
                </div>
              </div>
            ))}
            <button style={{ ...styles.markAllBtn, marginTop: 12, width: "100%", textAlign: "center" }} onClick={() => { setShowPanel(false); navigate("/notifications"); }}>
              View all notifications →
            </button>
          </div>
        </>
      )}

      {/* User Menu */}
      {showUserMenu && (
        <>
          <div style={styles.overlay} onClick={() => setShowUserMenu(false)} />
          <div style={{ ...styles.panel, right: 8, width: 200 }}>
            <div style={{ textAlign: "center", paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#06122b", color: "white", fontSize: 20, fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>{initials}</div>
              <div style={{ fontWeight: "bold", fontSize: 14 }}>{user.name}</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{user.role}</div>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              <button style={styles.menuItem} onClick={() => { navigate("/profile"); setShowUserMenu(false); }}>👤 My Profile</button>
              <button style={styles.menuItem} onClick={() => { navigate("/notifications"); setShowUserMenu(false); }}>🔔 Notifications</button>
              <button style={{ ...styles.menuItem, color: "#dc2626" }} onClick={logout}>🚪 Logout</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const styles = {
  nav: { height: "60px", background: "#F3F4F6", display: "flex", alignItems: "center", paddingLeft: "16px", paddingRight: "16px", gap: "12px", borderBottom: "1px solid #ddd", position: "sticky", top: 0, zIndex: 20 },
  menuBtn: { background: "#06122b", color: "white", border: "none", borderRadius: "6px", padding: "8px 12px", fontSize: "18px", cursor: "pointer", flexShrink: 0 },
  title: { margin: 0, fontSize: "14px", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  right: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  bellBtn: { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 10px", fontSize: 18, cursor: "pointer", position: "relative" },
  badge: { position: "absolute", top: -6, right: -6, background: "#dc2626", color: "white", fontSize: 10, fontWeight: "bold", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  avatarBtn: { width: 36, height: 36, borderRadius: "50%", background: "#06122b", color: "white", border: "none", fontWeight: "bold", fontSize: 14, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, zIndex: 25 },
  panel: { position: "fixed", top: 64, width: 320, maxWidth: "calc(100vw - 16px)", background: "white", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", zIndex: 30, padding: 16, maxHeight: "80vh", overflowY: "auto" },
  notifItem: { padding: "10px 12px", borderRadius: 8, marginBottom: 8, cursor: "pointer" },
  markAllBtn: { background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, cursor: "pointer", color: "#2563eb" },
  menuItem: { background: "none", border: "none", padding: "10px 12px", borderRadius: 6, cursor: "pointer", fontSize: 14, textAlign: "left", width: "100%" }
};
