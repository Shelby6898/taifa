import { useNavigate, useLocation, Outlet } from "react-router-dom";
import DashboardHome from "./DashboardHome";
import { useState, useEffect } from "react";
import useOrg from "../hooks/useOrg";

const navItems = [
  { path: "/dashboard",              icon: "📊", label: "Dashboard"    },
  { path: "/dashboard/assets",       icon: "🏛️", label: "Assets"       },
  { path: "/dashboard/transfers",    icon: "🔄", label: "Transfers",   hideViewer: true },
  { path: "/dashboard/maintenance",  icon: "🔧", label: "Maintenance"  },
  { path: "/dashboard/depreciation", icon: "📉", label: "Depreciation", hideViewer: true },
  { path: "/dashboard/reports",      icon: "📈", label: "Reports"      },
  { path: "/dashboard/notifications",icon: "🔔", label: "Notifications", showBadge: true },
  { path: "/dashboard/ict-helpdesk", icon: "🎫", label: "Taifa Helpdesk" },
  { path: "/dashboard/users",        icon: "👥", label: "Users",  adminOnly: true },
  { path: "/dashboard/organizations", icon: "🏢", label: "Organizations", superAdminOnly: true },
  { path: "/dashboard/settings",     icon: "⚙️", label: "Settings" },
  { path: "/dashboard/profile",      icon: "👤", label: "My Profile" },
  { path: "/dashboard/org-settings", icon: "🏢", label: "Org Settings", adminOnly: true, hideSuperAdmin: true },
  { path: "/dashboard/categories",   icon: "🗂️", label: "Categories",  adminOnly: true },
  { path: "/dashboard/checkinout",   icon: "🔄", label: "Check In/Out", hideViewer: true },
  { path: "/dashboard/asset-requests", icon: "📋", label: "Asset Requests", hideAdmin: true },
  { path: "/dashboard/disposals",    icon: "🗑️", label: "Disposals",   adminOnly: true },
];

export default function Dashboard() {
  const user     = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const { org } = useOrg();
  const [unreadCount, setUnreadCount] = useState(0); // eslint-disable-line no-unused-vars

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadUnread() {
    try {
      const { api } = await import('../api');
      const res = await api.get('/notifications');
      const unread = (res.data.data || []).filter(n => !n.isRead).length;
      setUnreadCount(unread);
    } catch (e) {}
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const styles = {
    wrapper: { fontFamily: "sans-serif" },
    sidebar: { background: "#1e293b" },
    logo:     { padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", gap: 10 },
    logoText: { color: "#fff", fontWeight: 800, fontSize: 18, whiteSpace: "nowrap",
                opacity: sidebarOpen ? 1 : 0, transition: "opacity 0.2s" },
    nav:      { flex: 1, padding: "12px 8px", overflowY: "auto" },
    navItem:  (active) => ({
      display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
      borderRadius: 8, cursor: "pointer", marginBottom: 2, whiteSpace: "nowrap",
      background: active ? "rgba(99,102,241,0.2)" : "transparent",
      border: active ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
      color: active ? "#a5b4fc" : "#94a3b8",
      transition: "all 0.15s"
    }),
    navIcon:  { fontSize: 16, flexShrink: 0 },
    navLabel: { fontSize: 13, fontWeight: 500, opacity: sidebarOpen ? 1 : 0, transition: "opacity 0.2s" },
    footer:   { padding: "12px 8px", borderTop: "1px solid rgba(255,255,255,0.08)" },
    main: {},
    topbar: { background: "#fff", borderBottom: "1px solid #e2e8f0" },
    content: {},
    userChip: { display: "flex", alignItems: "center", gap: 8, background: "#f1f5f9",
                border: "1px solid #e2e8f0", borderRadius: 30, padding: "4px 12px 4px 4px" },
    avatar:   { width: 28, height: 28, background: "#6366f1", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: 700 },
  };

  const visibleNav = navItems.filter(n => {
    if (n.adminOnly && user.role !== "admin" && user.role !== "super-admin") return false;
    if (n.superAdminOnly && user.role !== "super-admin") return false;
    if (n.hideViewer && user.role === "viewer") return false;
    if (n.hideSuperAdmin && user.role === "super-admin") return false;
    if (n.hideAdmin && user.role === "admin") return false;
    return true;
  });
  const isHome = location.pathname === "/dashboard";

  return (
    <div className="dashboard-shell" style={styles.wrapper}>
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`} style={styles.sidebar} aria-label="Main navigation">
        <div style={styles.logo}>
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="Organization logo" style={{ width: 26, height: 26, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <span style={{ fontSize: 22 }}>🏛️</span>
          )}
          <span style={styles.logoText}>Taifatech</span>
        </div>
        <nav style={styles.nav}>
          {visibleNav.map(item => (
            <button
              key={item.path}
              type="button"
              className="dashboard-nav-button"
              title={!sidebarOpen ? item.label : undefined}
              aria-current={
                location.pathname === item.path ||
                (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"))
                  ? "page"
                  : undefined
              }
              style={styles.navItem(
                location.pathname === item.path ||
                (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"))
              )}
              onClick={() => {
                navigate(item.path);
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}>
              <span style={styles.navIcon} aria-hidden="true">{item.icon}</span>
              <span style={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={styles.footer}>
          <button
            type="button"
            className="dashboard-nav-button"
            style={styles.navItem(false)}
            onClick={logout}
            title={!sidebarOpen ? "Sign Out" : undefined}>
            <span style={styles.navIcon} aria-hidden="true">🚪</span>
            <span style={styles.navLabel}>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dashboard-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <div className="dashboard-main" style={styles.main}>
        {/* Topbar */}
        <header className="dashboard-topbar" style={styles.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              className="dashboard-menu-toggle"
              aria-label={sidebarOpen ? "Collapse navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(!sidebarOpen)}>
              ☰
            </button>
            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 15 }}>
              {navItems.find(n => n.path === location.pathname)?.label || "Dashboard"}
            </span>
          </div>
          <div style={styles.userChip}>
            <div style={styles.avatar}>{(user.name||"U")[0].toUpperCase()}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{user.name}</span>
            <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>({user.role})</span>
          </div>
        </header>

        {/* Content */}
        <main className="dashboard-content" style={styles.content}>
          {isHome ? <DashboardHome /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
