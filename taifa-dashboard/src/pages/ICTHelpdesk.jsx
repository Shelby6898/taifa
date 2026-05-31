import { useEffect, useState } from "react";
import { api } from "../api";

const statusColor = { open:"#f59e0b", assigned:"#22d3ee", "in-progress":"#818cf8", resolved:"#10b981", closed:"#6ee7b7" };
const priorityColor = { high:"#ef4444", medium:"#f59e0b", low:"#10b981", urgent:"#dc2626" };

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5
    }}>{text}</span>
  );
}

export default function ICTHelpdesk() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const [tickets, setTickets]       = useState([]);
  const [agents, setAgents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState("tickets");
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments]     = useState([]);
  const [commentMsg, setCommentMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]       = useState("");

  // Submit ticket form
  const [form, setForm] = useState({
    title: "", category: "", priority: "medium", device: "", description: ""
  });

  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const r = await api.get("/tickets");
      setTickets(r.data.tickets || []);
      if (isAdmin) {
        const a = await api.get("/agents");
        setAgents(a.data.agents || []);
      }
    } catch (e) {
      setMessage("Failed to load tickets.");
    } finally { setLoading(false); }
  }

  async function submitTicket(e) {
    e.preventDefault();
    if (!form.title || !form.category || !form.description) {
      return setMessage("Please fill in Title, Category and Description.");
    }
    setSubmitting(true);
    try {
      await api.post("/tickets", form);
      setMessage("✅ Ticket submitted successfully!");
      setForm({ title: "", category: "", priority: "medium", device: "", description: "" });
      loadTickets();
    } catch (e) {
      setMessage("❌ Failed to submit ticket.");
    } finally { setSubmitting(false); }
  }

  async function changeStatus(id, status) {
    try {
      await api.patch(`/tickets/${id}/status`, { status });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      if (selectedTicket?.id === id) setSelectedTicket(prev => ({ ...prev, status }));
    } catch (e) { setMessage("Failed to update status."); }
  }

  async function assignTicket(id, agentId) {
    try {
      if (!agentId) {
        await api.patch(`/tickets/${id}/unassign`);
        setTickets(prev => prev.map(t => t.id === id ? { ...t, assignedTo: null, assignedToName: null, status: "open" } : t));
      } else {
        const r = await api.patch(`/tickets/${id}/assign`, { agentId });
        const name = r.data.assignedTo?.name || "";
        setTickets(prev => prev.map(t => t.id === id ? { ...t, assignedTo: agentId, assignedToName: name, status: "assigned" } : t));
      }
    } catch (e) { setMessage("Failed to assign ticket."); }
  }

  async function deleteTicket(id) {
    if (!window.confirm("Delete this ticket?")) return;
    try {
      await api.delete(`/tickets/${id}`);
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedTicket?.id === id) setSelectedTicket(null);
    } catch (e) { setMessage("Failed to delete ticket."); }
  }

  async function openTicket(ticket) {
    setSelectedTicket(ticket);
    setComments([]);
    try {
      const r = await api.get(`/tickets/${ticket.id}/comments`);
      setComments(r.data.comments || []);
    } catch (e) {}
  }

  async function sendComment() {
    if (!commentMsg.trim()) return;
    setSubmitting(true);
    try {
      const r = await api.post(`/tickets/${selectedTicket.id}/comments`, { message: commentMsg });
      setComments(prev => [...prev, r.data]);
      setCommentMsg("");
    } catch (e) { setMessage("Failed to send comment."); }
    finally { setSubmitting(false); }
  }

  function exportTickets(format) {
    const params = new URLSearchParams();
    if (filterStatus)   params.append("status", filterStatus);
    if (filterPriority) params.append("priority", filterPriority);
    if (filterCategory) params.append("category", filterCategory);
    if (search)         params.append("search", search);
    const token = localStorage.getItem("token");
    fetch(`http://localhost:4000/api/export/${format}?${params}`, {
      headers: { Authorization: "Bearer " + token }
    }).then(r => r.blob()).then(blob => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tickets-${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
    });
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    const d = new Date(ts._seconds ? ts._seconds * 1000 : ts);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  const filtered = tickets.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = !s || (t.title||"").toLowerCase().includes(s) ||
      (t.userEmail||"").toLowerCase().includes(s) || (t.id||"").toLowerCase().includes(s);
    return matchSearch &&
      (!filterStatus   || t.status   === filterStatus) &&
      (!filterPriority || t.priority === filterPriority) &&
      (!filterCategory || t.category === filterCategory);
  });

  // Stats
  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t => t.status === "open").length,
    progress: tickets.filter(t => ["in-progress","assigned"].includes(t.status)).length,
    closed:   tickets.filter(t => ["closed","resolved"].includes(t.status)).length,
  };

  const styles = {
    container: { padding: "24px", fontFamily: "sans-serif", maxWidth: 1200, margin: "0 auto" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 700, color: "#1e293b" },
    tabs: { display: "flex", gap: 8, marginBottom: 24 },
    tab: (active) => ({
      padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600,
      background: active ? "#6366f1" : "#f1f5f9", color: active ? "#fff" : "#64748b", fontSize: 13
    }),
    statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 },
    statCard: (color) => ({
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16,
      borderTop: `3px solid ${color}`
    }),
    statLabel: { fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 },
    statValue: { fontSize: 32, fontWeight: 700, color: "#1e293b" },
    card: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" },
    toolbar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
    input: { padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" },
    select: { padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, background: "#fff" },
    btn: (color="#6366f1") => ({
      padding: "8px 16px", background: color, color: "#fff", border: "none",
      borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13
    }),
    btnSm: (color="#6366f1") => ({
      padding: "4px 10px", background: color+"22", color, border: `1px solid ${color}44`,
      borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 11
    }),
    table: { width: "100%", borderCollapse: "collapse" },
    th: { background: "#f8fafc", padding: "10px 14px", fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", color: "#64748b", textAlign: "left", borderBottom: "1px solid #e2e8f0" },
    td: { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
    form: { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24 },
    field: { marginBottom: 16 },
    label: { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
    fieldInput: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
    modal: { background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto" },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🎫 ICT Helpdesk</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
            {isAdmin ? "Manage all support tickets" : "Submit and track your IT support tickets"}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={styles.btn("#10b981")} onClick={() => exportTickets("excel")}>📊 Excel</button>
            <button style={styles.btn("#ef4444")} onClick={() => exportTickets("pdf")}>📄 PDF</button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{ background: message.includes("✅") ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${message.includes("✅") ? "#bbf7d0" : "#fecaca"}`,
          color: message.includes("✅") ? "#166534" : "#991b1b",
          padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {message}
          <button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === "tickets")} onClick={() => setActiveTab("tickets")}>
          📋 {isAdmin ? "All Tickets" : "My Tickets"}
        </button>
        {!isAdmin && (
          <button style={styles.tab(activeTab === "submit")} onClick={() => setActiveTab("submit")}>
            ➕ Submit Ticket
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard("#6366f1")}>
          <div style={styles.statLabel}>Total</div>
          <div style={styles.statValue}>{stats.total}</div>
        </div>
        <div style={styles.statCard("#f59e0b")}>
          <div style={styles.statLabel}>Open</div>
          <div style={styles.statValue}>{stats.open}</div>
        </div>
        <div style={styles.statCard("#818cf8")}>
          <div style={styles.statLabel}>In Progress</div>
          <div style={styles.statValue}>{stats.progress}</div>
        </div>
        <div style={styles.statCard("#10b981")}>
          <div style={styles.statLabel}>Closed</div>
          <div style={styles.statValue}>{stats.closed}</div>
        </div>
      </div>

      {/* Submit Ticket Tab */}
      {activeTab === "submit" && !isAdmin && (
        <div style={styles.form}>
          <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Submit a New Ticket</h3>
          <form onSubmit={submitTicket}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={styles.field}>
                <label style={styles.label}>Issue Title *</label>
                <input style={styles.fieldInput} placeholder="Brief summary"
                  value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Category *</label>
                <select style={styles.fieldInput} value={form.category}
                  onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="">Select category</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="network">Network</option>
                  <option value="account">Account</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Priority</label>
                <select style={styles.fieldInput} value={form.priority}
                  onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Affected Device</label>
                <input style={styles.fieldInput} placeholder="e.g. Dell Laptop"
                  value={form.device} onChange={e => setForm({...form, device: e.target.value})}/>
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Description *</label>
              <textarea style={{...styles.fieldInput, minHeight: 100, resize: "vertical"}}
                placeholder="Describe the issue in detail…"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
            </div>
            <button type="submit" style={styles.btn()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Ticket"}
            </button>
          </form>
        </div>
      )}

      {/* Tickets List Tab */}
      {activeTab === "tickets" && (
        <div style={styles.card}>
          {/* Toolbar */}
          <div style={{ padding: "16px 16px 0" }}>
            <div style={styles.toolbar}>
              <input style={{...styles.input, flex: 1, minWidth: 200}}
                placeholder="Search tickets…" value={search}
                onChange={e => setSearch(e.target.value)}/>
              <select style={styles.select} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select style={styles.select} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                <option value="">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select style={styles.select} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading tickets…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No tickets found.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ID</th>
                    {isAdmin && <th style={styles.th}>Requester</th>}
                    <th style={styles.th}>Issue</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Priority</th>
                    <th style={styles.th}>Status</th>
                    {isAdmin && <th style={styles.th}>Assign To</th>}
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => openTicket(t)}>
                      <td style={styles.td}>
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b",
                          background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                          {t.id.substring(0,10)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={styles.td} onClick={e => e.stopPropagation()}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{t.userName || t.requester || "—"}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.userEmail}</div>
                        </td>
                      )}
                      <td style={styles.td}>
                        <div style={{ fontWeight: 500 }}>{t.title}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.device || ""}</div>
                      </td>
                      <td style={styles.td}><Badge text={t.category||"—"} color="#6366f1"/></td>
                      <td style={styles.td}><Badge text={t.priority||"—"} color={priorityColor[t.priority]||"#64748b"}/></td>
                      <td style={styles.td} onClick={e => e.stopPropagation()}>
                        {isAdmin ? (
                          <select value={t.status} onChange={e => changeStatus(t.id, e.target.value)}
                            style={{ ...styles.select, fontSize: 11, padding: "4px 8px" }}>
                            <option value="open">Open</option>
                            <option value="assigned">Assigned</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        ) : (
                          <Badge text={t.status} color={statusColor[t.status]||"#64748b"}/>
                        )}
                      </td>
                      {isAdmin && (
                        <td style={styles.td} onClick={e => e.stopPropagation()}>
                          <select value={t.assignedTo||""} onChange={e => assignTicket(t.id, e.target.value)}
                            style={{ ...styles.select, fontSize: 11, padding: "4px 8px" }}>
                            <option value="">— Unassigned —</option>
                            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </td>
                      )}
                      <td style={{...styles.td, fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap"}}>
                        {fmtDate(t.createdAt)}
                      </td>
                      <td style={styles.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button style={styles.btnSm("#6366f1")} onClick={() => openTicket(t)}>💬</button>
                          {isAdmin && <button style={styles.btnSm("#ef4444")} onClick={() => deleteTicket(t.id)}>🗑</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div style={styles.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>🎫 Ticket Details</h3>
              <button onClick={() => setSelectedTicket(null)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Badge text={selectedTicket.status} color={statusColor[selectedTicket.status]||"#64748b"}/>
              <Badge text={selectedTicket.priority} color={priorityColor[selectedTicket.priority]||"#64748b"}/>
              <Badge text={selectedTicket.category} color="#6366f1"/>
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{selectedTicket.title}</h4>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
              <strong>Submitted by:</strong> {selectedTicket.userName || selectedTicket.requester} ({selectedTicket.userEmail})
            </p>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              <strong>Device:</strong> {selectedTicket.device || "—"} &nbsp;|&nbsp;
              <strong>Date:</strong> {fmtDate(selectedTicket.createdAt)}
            </p>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 13,
              color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
              {selectedTicket.description}
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>💬 Comments</h4>
              <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
                {comments.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 16 }}>
                    No comments yet.
                  </p>
                ) : comments.map(c => (
                  <div key={c.id} style={{
                    marginBottom: 10, display: "flex",
                    flexDirection: "column",
                    alignItems: c.authorRole === "admin" ? "flex-end" : "flex-start"
                  }}>
                    <div style={{
                      maxWidth: "85%", padding: "8px 12px", borderRadius: 10,
                      background: c.authorRole === "admin" ? "#ede9fe" : "#f1f5f9",
                      border: `1px solid ${c.authorRole === "admin" ? "#c4b5fd" : "#e2e8f0"}`
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: c.authorRole === "admin" ? "#6366f1" : "#22d3ee", marginBottom: 3 }}>
                        {c.authorRole === "admin" ? "🛡️ " : "👤 "}{c.authorName}
                      </div>
                      <div style={{ fontSize: 13, color: "#334155" }}>{c.message}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{fmtDate(c.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={commentMsg} onChange={e => setCommentMsg(e.target.value)}
                  placeholder="Type your reply…"
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8,
                    fontSize: 13, resize: "none", minHeight: 60, outline: "none" }}/>
                <button style={{ ...styles.btn(), alignSelf: "flex-end", padding: "10px 16px" }}
                  onClick={sendComment} disabled={submitting}>
                  {submitting ? "…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
