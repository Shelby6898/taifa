import { useEffect, useState } from "react";
import { api } from "../api";

const statusColor = { open:"#f59e0b", assigned:"#22d3ee", "in-progress":"#818cf8", resolved:"#10b981", closed:"#6ee7b7" };
const priorityColor = { high:"#ef4444", medium:"#f59e0b", low:"#10b981", urgent:"#dc2626" };

function Badge({ text, color }) {
  return (
    <span style={{
      background: color + "22", color, border: `1px solid ${color}44`,
      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap"
    }}>{text}</span>
  );
}

export default function ICTHelpdesk() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = ["admin", "manager"].includes(user.role);
  const canManage = user.role === "admin";

  const [tickets, setTickets]     = useState([]);
  const [agents, setAgents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("tickets");
  const [search, setSearch]       = useState("");
  const [filterStatus, setFilterStatus]     = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments]   = useState([]);
  const [commentMsg, setCommentMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]     = useState("");
  const [form, setForm] = useState({
    title: "", category: "", priority: "medium",
    device: "", description: "", department: user.department || ""
  });

  useEffect(() => { loadTickets(); }, []);

  async function loadTickets() {
    setLoading(true);
    try {
      const r = await api.get("/tickets");
      setTickets(r.data.tickets || []);
      setMessage("");
      if (isAdmin) {
        const a = await api.get("/agents").catch(() => ({ data: { agents: [] } }));
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
      setForm({ title: "", category: "", priority: "medium", device: "", description: "", department: user.department || "" });
      setActiveTab("tickets");
      loadTickets();
    } catch (e) {
      setMessage("❌ Failed to submit ticket.");
    } finally { setSubmitting(false); }
  }

  async function changeStatus(id, status) {
    try {
      await api.patch(`/tickets/${id}/status`, { status });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
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
    let d;
    if (ts._seconds) d = new Date(ts._seconds * 1000);
    else if (ts.seconds) d = new Date(ts.seconds * 1000);
    else if (ts.toDate) d = ts.toDate();
    else d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
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

  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t => t.status === "open").length,
    progress: tickets.filter(t => ["in-progress","assigned"].includes(t.status)).length,
    closed:   tickets.filter(t => ["closed","resolved"].includes(t.status)).length,
  };

  const s = {
    wrap:    { padding: "20px 16px", fontFamily: "sans-serif" },
    hdr:     { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 },
    title:   { fontSize: 20, fontWeight: 700, color: "#1e293b" },
    sub:     { color: "#64748b", fontSize: 13, marginTop: 2 },
    tabs:    { display: "flex", gap: 8, marginBottom: 16 },
    tab:     (a) => ({ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: a ? "#6366f1" : "#f1f5f9", color: a ? "#fff" : "#64748b" }),
    grid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 },
    stat:    (c) => ({ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", borderTop: `3px solid ${c}` }),
    slabel:  { fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 },
    sval:    { fontSize: 26, fontWeight: 700, color: "#1e293b" },
    card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 },
    toolbar: { padding: "12px 14px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #f1f5f9" },
    input:   { padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", flex: 1, minWidth: 120 },
    sel:     { padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, background: "#fff" },
    btn:     (c="#6366f1") => ({ padding: "8px 14px", background: c, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }),
    btnSm:   (c="#6366f1") => ({ padding: "4px 10px", background: c+"22", color: c, border: `1px solid ${c}44`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 11 }),
    field:   { marginBottom: 14 },
    label:   { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5, textTransform: "uppercase" },
    finput:  { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    modal:   { background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 500, maxHeight: "88vh", overflowY: "auto" },
    msg:     (ok) => ({ background: ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, color: ok ? "#166534" : "#991b1b", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, display: "flex", justifyContent: "space-between" }),
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.hdr}>
        <div>
          <div style={s.title}>🎫 ICT Helpdesk</div>
          <div style={s.sub}>{isAdmin ? "Manage all support tickets" : "Submit and track your IT support tickets"}</div>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btn("#10b981")} onClick={() => exportTickets("excel")}>📊 Excel</button>
            <button style={s.btn("#ef4444")} onClick={() => exportTickets("pdf")}>📄 PDF</button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={s.msg(message.includes("✅"))}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        <button style={s.tab(activeTab === "tickets")} onClick={() => setActiveTab("tickets")}>
          📋 {isAdmin ? "All Tickets" : "My Tickets"}
        </button>
        {!isAdmin && (
          <button style={s.tab(activeTab === "submit")} onClick={() => setActiveTab("submit")}>
            ➕ Submit Ticket
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={s.grid}>
        <div style={s.stat("#6366f1")}><div style={s.slabel}>Total</div><div style={s.sval}>{stats.total}</div></div>
        <div style={s.stat("#f59e0b")}><div style={s.slabel}>Open</div><div style={s.sval}>{stats.open}</div></div>
        <div style={s.stat("#818cf8")}><div style={s.slabel}>In Progress</div><div style={s.sval}>{stats.progress}</div></div>
        <div style={s.stat("#10b981")}><div style={s.slabel}>Closed</div><div style={s.sval}>{stats.closed}</div></div>
      </div>

      {/* Submit Form */}
      {activeTab === "submit" && !isAdmin && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Submit a New Ticket</h3>
          <form onSubmit={submitTicket}>
            <div style={s.field}>
              <label style={s.label}>Issue Title *</label>
              <input style={s.finput} placeholder="Brief summary of the issue"
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={s.field}>
                <label style={s.label}>Category *</label>
                <select style={s.finput} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  <option value="">Select category</option>
                  <option value="hardware">Hardware</option>
                  <option value="software">Software</option>
                  <option value="network">Network</option>
                  <option value="account">Account</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Priority</label>
                <select style={s.finput} value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Department</label>
                <select style={s.finput} value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                  <option value="">Select department</option>
                  <option value="Finance">Finance</option>
                  <option value="ICT">ICT</option>
                  <option value="Health">Health</option>
                  <option value="Education">Education</option>
                  <option value="Roads">Roads</option>
                  <option value="Water">Water</option>
                  <option value="Administration">Administration</option>
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Affected Device</label>
                <input style={s.finput} placeholder="e.g. Dell Laptop"
                  value={form.device} onChange={e => setForm({...form, device: e.target.value})}/>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Description *</label>
              <textarea style={{...s.finput, minHeight: 90, resize: "vertical"}}
                placeholder="Describe the issue in detail…"
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}/>
            </div>
            <button type="submit" style={s.btn()} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Ticket"}
            </button>
          </form>
        </div>
      )}

      {/* Tickets List */}
      {activeTab === "tickets" && (
        <div style={s.card}>
          {/* Toolbar */}
          <div style={s.toolbar}>
            <input style={s.input} placeholder="Search tickets…"
              value={search} onChange={e => setSearch(e.target.value)}/>
            <select style={s.sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select style={s.sel} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select style={s.sel} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Ticket Cards */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading tickets…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No tickets found.</div>
          ) : filtered.map(t => (
            <div key={t.id} style={{ borderBottom: "1px solid #f1f5f9", padding: "14px 16px", cursor: "pointer" }}
              onClick={() => openTicket(t)}>

              {/* Badges */}
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                  {t.id.substring(0,12)}
                </span>
                <Badge text={t.priority||"—"} color={priorityColor[t.priority]||"#64748b"}/>
                <Badge text={t.category||"—"} color="#6366f1"/>
                {t.department && (
                  <span style={{ fontSize: 10, color: "#6366f1", fontWeight: 600, background: "#ede9fe", padding: "2px 6px", borderRadius: 4 }}>
                    {t.department}
                  </span>
                )}
              </div>

              {/* Title */}
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1e293b", marginBottom: 4 }}>{t.title}</div>

              {/* Requester */}
              {isAdmin && (
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                  👤 {t.userName || t.requester || "—"} • {t.userEmail}{t.device ? ` • ${t.device}` : ""}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}
                onClick={e => e.stopPropagation()}>
                {isAdmin ? (
                  <select value={t.status} onChange={e => changeStatus(t.id, e.target.value)}
                    style={{ ...s.sel, fontSize: 11, padding: "4px 8px" }}>
                    <option value="open">Open</option>
                    <option value="assigned">Assigned</option>
                    <option value="in-progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                ) : (
                  <Badge text={t.status} color={statusColor[t.status]||"#64748b"}/>
                )}
                {canManage && (
                  <select value={t.assignedTo||""} onChange={e => assignTicket(t.id, e.target.value)}
                    style={{ ...s.sel, fontSize: 11, padding: "4px 8px" }}>
                    <option value="">— Unassigned —</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>📅 {fmtDate(t.createdAt)}</span>
                <button style={s.btnSm("#6366f1")} onClick={() => openTicket(t)}>💬</button>
                {canManage && (
                  <button style={s.btnSm("#ef4444")} onClick={() => deleteTicket(t.id)}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div style={s.overlay} onClick={() => setSelectedTicket(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>🎫 Ticket Details</h3>
              <button onClick={() => setSelectedTicket(null)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge text={selectedTicket.status} color={statusColor[selectedTicket.status]||"#64748b"}/>
              <Badge text={selectedTicket.priority} color={priorityColor[selectedTicket.priority]||"#64748b"}/>
              <Badge text={selectedTicket.category} color="#6366f1"/>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{selectedTicket.title}</h4>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 2 }}>
              <strong>By:</strong> {selectedTicket.userName || selectedTicket.requester} ({selectedTicket.userEmail})
            </p>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
              <strong>Device:</strong> {selectedTicket.device || "—"} | <strong>Date:</strong> {fmtDate(selectedTicket.createdAt)}
            </p>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12, fontSize: 13, color: "#475569", lineHeight: 1.6, marginBottom: 14 }}>
              {selectedTicket.description}
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>💬 Comments</h4>
              <div style={{ maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
                {comments.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 12 }}>No comments yet.</p>
                ) : comments.map(c => (
                  <div key={c.id} style={{ marginBottom: 8, display: "flex", flexDirection: "column", alignItems: c.authorRole === "admin" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "85%", padding: "8px 12px", borderRadius: 10,
                      background: c.authorRole === "admin" ? "#ede9fe" : "#f1f5f9",
                      border: `1px solid ${c.authorRole === "admin" ? "#c4b5fd" : "#e2e8f0"}` }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: c.authorRole === "admin" ? "#6366f1" : "#22d3ee", marginBottom: 2 }}>
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
                  style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, resize: "none", minHeight: 55, outline: "none" }}/>
                <button style={{ ...s.btn(), alignSelf: "flex-end", padding: "10px 14px" }}
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
