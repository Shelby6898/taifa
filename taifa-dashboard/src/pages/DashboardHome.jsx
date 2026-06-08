import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#22d3ee","#8b5cf6","#ec4899"];

export default function DashboardHome() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const navigate = useNavigate();
  const isViewer = user.role === "viewer";

  const [summary,   setSummary]   = useState(null);
  const [tickets,   setTickets]   = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, t, tr, m] = await Promise.all([
        api.get("/reports/summary").catch(() => ({ data: { data: null } })),
        api.get("/tickets").catch(() => ({ data: { tickets: [] } })),
        api.get("/transfers").catch(() => ({ data: { data: [] } })),
        api.get("/maintenance").catch(() => ({ data: { data: [] } }))
      ]);
      if (s.data.data) setSummary({...s.data.data.summary, byType: s.data.data.byType, byDepartment: s.data.data.byDepartment});
      setTickets(t.data.tickets || []);
      setTransfers(tr.data.data || []);
      setMaintenance(m.data.data || []);
    } catch (e) {}
    finally { setLoading(false); }
  }

  const ticketStats = {
    total:    tickets.length,
    open:     tickets.filter(t => t.status === "open").length,
    progress: tickets.filter(t => ["in-progress","assigned"].includes(t.status)).length,
    closed:   tickets.filter(t => ["closed","resolved"].includes(t.status)).length,
  };

  const transferStats = {
    total:    transfers.length,
    pending:  transfers.filter(t => t.status === "pending").length,
    approved: transfers.filter(t => t.status === "approved").length,
    denied:   transfers.filter(t => t.status === "denied").length,
  };

  const ticketPieData = [
    { name: "Open",        value: ticketStats.open },
    { name: "In Progress", value: ticketStats.progress },
    { name: "Closed",      value: ticketStats.closed },
  ].filter(d => d.value > 0);

  const typeMap = {};
  (summary?.byType || []).forEach(t => {
    const name = (t.type || "Unknown").trim();
    typeMap[name] = (typeMap[name] || 0) + t.count;
  });
  const assetsByType = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  const deptMap = {};
  (summary?.byDepartment || []).forEach(d => {
    const name = (d.department || "Unknown").trim();
    deptMap[name] = (deptMap[name] || 0) + d.count;
  });
  const assetsByDept = Object.entries(deptMap).map(([name, value]) => ({ name: name.substring(0,10), value }));

  // Maintenance stats
  const maintenanceStats = {
    total:      maintenance.length,
    scheduled:  maintenance.filter(m => m.status === "scheduled").length,
    inProgress: maintenance.filter(m => m.status === "in-progress").length,
    completed:  maintenance.filter(m => m.status === "completed").length,
    overdue:    maintenance.filter(m => m.status === "overdue").length,
  };

  // Maintenance by department
  const maintDeptMap = {};
  maintenance.forEach(m => {
    const d = m.department || "General";
    if (!maintDeptMap[d]) maintDeptMap[d] = { dept: d.substring(0,8), count: 0 };
    maintDeptMap[d].count += 1;
  });
  const maintenanceByDept = Object.values(maintDeptMap);

  // Tickets by department
  const ticketDeptMap = {};
  tickets.forEach(t => {
    const d = t.department || "General";
    if (!ticketDeptMap[d]) ticketDeptMap[d] = { dept: d.substring(0,8), count: 0 };
    ticketDeptMap[d].count += 1;
  });
  const ticketsByDept = Object.values(ticketDeptMap);

  // Tickets by category
  const ticketCatMap = {};
  tickets.forEach(t => {
    const c = t.category || "other";
    if (!ticketCatMap[c]) ticketCatMap[c] = { name: c, value: 0 };
    ticketCatMap[c].value += 1;
  });
  const ticketsByCategory = Object.values(ticketCatMap);

  const styles = {
    container:  { padding: "24px", fontFamily: "sans-serif" },
    welcome:    { marginBottom: 24 },
    title:      { fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
    sub:        { color: "#64748b", fontSize: 14 },
    grid4:      { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 24 },
    grid2:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 },
    grid3:      { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 },
    statCard:   (color) => ({ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, borderTop: `3px solid ${color}` }),
    statLabel:  { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 },
    statValue:  { fontSize: 28, fontWeight: 700, color: "#1e293b" },
    chartCard:  { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 },
    chartTitle: { fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12, marginTop: 8 },
    moduleCard: (color) => ({
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: 16, cursor: "pointer", textAlign: "center",
      borderLeft: `4px solid ${color}`, display: "flex", alignItems: "center", gap: 12
    }),
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading dashboard…</div>
  );

  return (
    <div style={styles.container}>

      {/* Welcome */}
      <div style={styles.welcome}>
        <h2 style={styles.title}>Welcome back, {user.name}! 👋</h2>
        <p style={styles.sub}>Taifa County Asset Management Platform — {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</p>
      </div>

      {/* Asset Stats */}
      <p style={styles.sectionTitle}>🏛️ Asset Overview</p>
      <div style={styles.grid4}>
        <div style={styles.statCard("#6366f1")}>
          <div style={styles.statLabel}>Total Assets</div>
          <div style={styles.statValue}>{summary?.total || 0}</div>
        </div>
        <div style={styles.statCard("#10b981")}>
          <div style={styles.statLabel}>Active</div>
          <div style={styles.statValue}>{summary?.active || 0}</div>
        </div>
        <div style={styles.statCard("#f59e0b")}>
          <div style={styles.statLabel}>Maintenance</div>
          <div style={styles.statValue}>{summary?.maintenance || 0}</div>
        </div>
        {!isViewer && (
          <div style={styles.statCard("#10b981")}>
            <div style={styles.statLabel}>Transfers</div>
            <div style={styles.statValue}>{transfers.length}</div>
          </div>
        )}
        <div style={styles.statCard("#3b82f6")}>
          <div style={styles.statLabel}>Total Value</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            KES {(summary?.totalValue || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Transfer Stats - hidden for viewers */}
      {!isViewer && (
        <>
          <p style={styles.sectionTitle}>🔄 Transfers Overview</p>
          <div style={styles.grid4}>
            <div style={styles.statCard("#1e293b")}>
              <div style={styles.statLabel}>Total</div>
              <div style={styles.statValue}>{transferStats.total}</div>
            </div>
            <div style={styles.statCard("#f59e0b")}>
              <div style={styles.statLabel}>Pending</div>
              <div style={styles.statValue}>{transferStats.pending}</div>
            </div>
            <div style={styles.statCard("#10b981")}>
              <div style={styles.statLabel}>Approved</div>
              <div style={styles.statValue}>{transferStats.approved}</div>
            </div>
            <div style={styles.statCard("#ef4444")}>
              <div style={styles.statLabel}>Denied</div>
              <div style={styles.statValue}>{transferStats.denied}</div>
            </div>
          </div>
        </>
      )}

      {/* ICT Ticket Stats */}
      <p style={styles.sectionTitle}>🔧 Maintenance Overview</p>
      <div style={styles.grid4}>
        <div style={styles.statCard("#1e293b")}><div style={styles.statLabel}>Total</div><div style={styles.statValue}>{maintenanceStats.total}</div></div>
        <div style={styles.statCard("#6366f1")}><div style={styles.statLabel}>Scheduled</div><div style={styles.statValue}>{maintenanceStats.scheduled}</div></div>
        <div style={styles.statCard("#f59e0b")}><div style={styles.statLabel}>In Progress</div><div style={styles.statValue}>{maintenanceStats.inProgress}</div></div>
        <div style={styles.statCard("#10b981")}><div style={styles.statLabel}>Completed</div><div style={styles.statValue}>{maintenanceStats.completed}</div></div>
        <div style={styles.statCard("#ef4444")}><div style={styles.statLabel}>Overdue</div><div style={styles.statValue}>{maintenanceStats.overdue}</div></div>
      </div>

      {!isViewer && maintenance.length > 0 && (
        <div style={styles.grid2}>
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>🔧 Maintenance by Status</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[
                  { name: "Scheduled",   value: maintenanceStats.scheduled },
                  { name: "In Progress", value: maintenanceStats.inProgress },
                  { name: "Completed",   value: maintenanceStats.completed },
                  { name: "Overdue",     value: maintenanceStats.overdue },
                ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80}
                  dataKey="value" label={({name, value}) => name + ': ' + value} labelLine={false}>
                  <Cell fill="#6366f1" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>🏢 Maintenance by Department</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={maintenanceByDept}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Maintenance" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p style={styles.sectionTitle}>🎫 Taifa Helpdesk Overview</p>
      <div style={styles.grid4}>
        <div style={styles.statCard("#6366f1")}>
          <div style={styles.statLabel}>Total Tickets</div>
          <div style={styles.statValue}>{ticketStats.total}</div>
        </div>
        <div style={styles.statCard("#f59e0b")}>
          <div style={styles.statLabel}>Open</div>
          <div style={styles.statValue}>{ticketStats.open}</div>
        </div>
        <div style={styles.statCard("#818cf8")}>
          <div style={styles.statLabel}>In Progress</div>
          <div style={styles.statValue}>{ticketStats.progress}</div>
        </div>
        <div style={styles.statCard("#10b981")}>
          <div style={styles.statLabel}>Closed</div>
          <div style={styles.statValue}>{ticketStats.closed}</div>
        </div>
      </div>

      {/* Charts - hidden for viewers */}
      {!isViewer && (
        <>
          <div style={styles.grid2}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>🔄 Transfers by Status</div>
              {transfers.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[
                      { name: "Pending",  value: transferStats.pending },
                      { name: "Approved", value: transferStats.approved },
                      { name: "Denied",   value: transferStats.denied },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" label={({name, value}) => name + ': ' + value} labelLine={false}>
                      <Cell fill="#f59e0b" />
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No transfers yet</div>}
            </div>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>🏢 Transfers by Department</div>
              {transfers.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={(() => {
                    const m = {};
                    transfers.forEach(t => {
                      const d = t.fromDepartment || "Unknown";
                      if (!m[d]) m[d] = { dept: d.substring(0,8), sent: 0, received: 0 };
                      m[d].sent += 1;
                      const r = t.toDepartment || "Unknown";
                      if (!m[r]) m[r] = { dept: r.substring(0,8), sent: 0, received: 0 };
                      m[r].received += 1;
                    });
                    return Object.values(m);
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="sent"     name="Sent"     fill="#6366f1" radius={[4,4,0,0]} />
                    <Bar dataKey="received" name="Received" fill="#10b981" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No transfers yet</div>}
            </div>
          </div>
          <div style={styles.grid2}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>📊 Assets by Type</div>
              {assetsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={assetsByType} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" label={({name, value}) => `${name}: ${value}`} labelLine={false}>
                      {assetsByType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No asset data yet</div>
              )}
            </div>

            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>🎫 Tickets by Status</div>
              {ticketPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ticketPieData} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" label={({name, value}) => `${name}: ${value}`} labelLine={false}>
                      {ticketPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No tickets yet</div>
              )}
            </div>
          </div>

          {assetsByDept.length > 0 && (
            <div style={{ ...styles.chartCard, marginBottom: 24 }}>
              <div style={styles.chartTitle}>🏢 Assets by Department</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assetsByDept}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={styles.grid2}>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>🎫 Tickets by Department</div>
              {ticketsByDept.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ticketsByDept}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="dept" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Tickets" fill="#8b5cf6" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No tickets yet</div>}
            </div>
            <div style={styles.chartCard}>
              <div style={styles.chartTitle}>🏷️ Tickets by Category</div>
              {ticketsByCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ticketsByCategory} cx="50%" cy="50%" outerRadius={80}
                      dataKey="value" label={({name, value}) => name + ': ' + value} labelLine={false}>
                      {ticketsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ textAlign:"center", padding: 40, color:"#94a3b8", fontSize:13 }}>No tickets yet</div>}
            </div>
          </div>

        </>
      )}

      {/* Quick Access */}
      <p style={styles.sectionTitle}>⚡ Quick Access</p>
      <div style={styles.grid3}>
        {[
          { path:"assets",       icon:"🏛️", label:"Assets",        color:"#6366f1" },
          !isViewer && { path:"transfers",    icon:"🔄", label:"Transfers",     color:"#10b981" },
          { path:"maintenance",  icon:"🔧", label:"Maintenance",   color:"#f59e0b" },
          { path:"depreciation", icon:"📉", label:"Depreciation",  color:"#ef4444" },
          { path:"reports",      icon:"📈", label:"Reports",       color:"#8b5cf6" },
          { path:"ict-helpdesk", icon:"🎫", label:"Taifa Helpdesk",  color:"#22d3ee" },
        ].filter(Boolean).map(item => (
          <div key={item.path} style={styles.moduleCard(item.color)}
            onClick={() => navigate(`/dashboard/${item.path}`)}>
            <span style={{ fontSize: 24 }}>{item.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{item.label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
