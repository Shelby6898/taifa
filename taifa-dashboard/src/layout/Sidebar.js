import { FaTachometerAlt, FaBoxOpen, FaExchangeAlt, FaFileAlt, FaUsers, FaWrench, FaChartLine } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";

const Sidebar = ({ open, setOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const navItems = [
    { icon: <FaTachometerAlt />, label: "Dashboard",    path: "/",             roles: ["admin", "manager", "viewer"] },
    { icon: <FaBoxOpen />,       label: "Assets",        path: "/assets",       roles: ["admin", "manager", "viewer"] },
    { icon: <FaWrench />,        label: "Maintenance",   path: "/maintenance",  roles: ["admin", "manager", "viewer"] },
    { icon: <FaChartLine />,     label: "Depreciation",  path: "/depreciation", roles: ["admin", "manager", "viewer"] },
    { icon: <FaExchangeAlt />,   label: "Transfers",     path: "/transfers",    roles: ["admin", "manager"] },
    { icon: <FaFileAlt />,       label: "Reports",       path: "/reports",      roles: ["admin", "manager"] },
    { icon: <FaUsers />,         label: "Users",         path: "/users",        roles: ["admin"] }
  ];

  const visible = navItems.filter(item => item.roles.includes(user.role));
  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <div style={{ ...styles.sidebar, transform: open ? "translateX(0)" : "translateX(-100%)" }}>
      <h1 style={styles.logo}>TAIFA</h1>
      <ul style={styles.list}>
        {visible.map(({ icon, label, path }) => (
          <li key={label}
            style={{ ...styles.item, background: location.pathname === path ? "rgba(255,255,255,0.15)" : "transparent" }}
            onClick={() => go(path)}>
            <span style={styles.icon}>{icon}</span>
            {label}
          </li>
        ))}
      </ul>
      <div style={styles.roleTag}>{user.role?.toUpperCase()}</div>
    </div>
  );
};

const styles = {
  sidebar: { position: "fixed", top: 0, left: 0, height: "100vh", width: "240px", background: "#06122b", color: "white", padding: "20px", zIndex: 40, transition: "transform 0.3s ease", boxSizing: "border-box", display: "flex", flexDirection: "column" },
  logo: { fontSize: "24px", fontWeight: "bold", marginBottom: "40px" },
  list: { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  item: { display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "15px", padding: "10px", borderRadius: "6px" },
  icon: { fontSize: "16px" },
  roleTag: { fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }
};

export default Sidebar;
