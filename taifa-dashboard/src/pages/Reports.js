import { useEffect, useState } from "react";
import { api } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isViewer = user.role === "viewer";
  const [audit, setAudit] = useState([]);
  const [userAudit, setUserAudit] = useState([]);
  const [tab, setTab] = useState("summary");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [s, a, u] = await Promise.all([
        api.get("/reports/summary"),
        !isViewer ? api.get("/reports/audit").catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        user.role === "admin" ? api.get("/reports/user-audit").catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } })
      ]);
      setSummary(s.data.data);
      setAudit(a.data.data);
      setUserAudit(u.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── PDF Exports ──────────────────────────────────────────
  const exportSummaryPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("Taifa County Asset Management System", 14, 15);
    doc.setFontSize(11);
    doc.text(`Summary Report — ${date}`, 14, 23);

    // Summary cards
    autoTable(doc, {
      startY: 30,
      head: [["Metric", "Value"]],
      body: [
        ["Total Assets", summary.summary.total],
        ["Active Assets", summary.summary.active],
        ["Deleted Assets", summary.summary.deleted],
        ["Total Value (KES)", summary.summary.totalValue.toLocaleString()]
      ],
      theme: "grid",
      headStyles: { fillColor: [6, 18, 43] }
    });

    // By Ward
    doc.text("Assets by Ward", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Ward", "Count", "Total Value (KES)"]],
      body: summary.byWard.map(r => [r.ward, r.count, r.totalValue.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: [6, 18, 43] }
    });

    // By Department
    doc.text("Assets by Department", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Department", "Count", "Total Value (KES)"]],
      body: summary.byDepartment.map(r => [r.department, r.count, r.totalValue.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: [6, 18, 43] }
    });

    // By Type
    doc.text("Assets by Type", 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 14,
      head: [["Type", "Count", "Total Value (KES)"]],
      body: summary.byType.map(r => [r.type, r.count, r.totalValue.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: [6, 18, 43] }
    });

    doc.save(`taifa-summary-report-${date}.pdf`);
  };

  const exportAuditPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text("Taifa County Asset Management System", 14, 15);
    doc.setFontSize(11);
    doc.text(`Audit Log Report — ${date}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [["Action", "Asset ID", "Changed By", "Reason", "Date"]],
      body: audit.map(log => [
        log.action,
        log.assetId,
        log.changedBy || "-",
        log.reason || "-",
        log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"
      ]),
      theme: "striped",
      headStyles: { fillColor: [6, 18, 43] },
      styles: { fontSize: 9 }
    });

    doc.save(`taifa-audit-log-${date}.pdf`);
  };

  // ── Excel Exports ─────────────────────────────────────────
  const exportSummaryExcel = () => {
    const date = new Date().toLocaleDateString();
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Taifa County Asset Management System"],
      [`Summary Report — ${date}`],
      [],
      ["Metric", "Value"],
      ["Total Assets", summary.summary.total],
      ["Active Assets", summary.summary.active],
      ["Deleted Assets", summary.summary.deleted],
      ["Total Value (KES)", summary.summary.totalValue]
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    // By Ward sheet
    const wardSheet = XLSX.utils.json_to_sheet(
      summary.byWard.map(r => ({ Ward: r.ward, Count: r.count, "Total Value (KES)": r.totalValue }))
    );
    XLSX.utils.book_append_sheet(wb, wardSheet, "By Ward");

    // By Department sheet
    const deptSheet = XLSX.utils.json_to_sheet(
      summary.byDepartment.map(r => ({ Department: r.department, Count: r.count, "Total Value (KES)": r.totalValue }))
    );
    XLSX.utils.book_append_sheet(wb, deptSheet, "By Department");

    // By Type sheet
    const typeSheet = XLSX.utils.json_to_sheet(
      summary.byType.map(r => ({ Type: r.type, Count: r.count, "Total Value (KES)": r.totalValue }))
    );
    XLSX.utils.book_append_sheet(wb, typeSheet, "By Type");

    XLSX.writeFile(wb, `taifa-summary-report-${date}.xlsx`);
  };

  const exportAuditExcel = () => {
    const date = new Date().toLocaleDateString();
    const wb = XLSX.utils.book_new();

    const sheet = XLSX.utils.json_to_sheet(
      audit.map(log => ({
        Action: log.action,
        "Asset ID": log.assetId,
        "Changed By": log.changedBy || "-",
        Reason: log.reason || "-",
        Date: log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"
      }))
    );
    XLSX.utils.book_append_sheet(wb, sheet, "Audit Log");
    XLSX.writeFile(wb, `taifa-audit-log-${date}.xlsx`);
  };

  if (loading) return <p style={{ padding: 20 }}>Loading reports...</p>;

  const tabs = [
    { key: "summary", label: "Summary" },
    { key: "byWard", label: "By Ward" },
    { key: "byDepartment", label: "By Dept" },
    { key: "byType", label: "By Type" },
    ...(!isViewer ? [{ key: "audit", label: "Audit Log" }] : []),
    ...(user.role === "admin" ? [{ key: "userAudit", label: "User Audit" }] : [])
  ];

  const isSummaryTab = ["summary", "byWard", "byDepartment", "byType"].includes(tab);

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0 }}>📋 Reports</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={styles.pdfBtn} onClick={isSummaryTab ? exportSummaryPDF : exportAuditPDF}>
            ⬇️ PDF
          </button>
          <button style={styles.xlsBtn} onClick={isSummaryTab ? exportSummaryExcel : exportAuditExcel}>
            ⬇️ Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: tab === t.key ? "#06122b" : "#e5e7eb",
            color: tab === t.key ? "white" : "#333", fontSize: 13
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      {tab === "summary" && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
          {[
            { label: "Total Assets", value: summary.summary.total, color: "#06122b" },
            { label: "Active", value: summary.summary.active, color: "#16a34a" },
            { label: "Deleted", value: summary.summary.deleted, color: "#dc2626" },
            { label: "Total Value", value: `KES ${summary.summary.totalValue.toLocaleString()}`, color: "#2563eb" }
          ].map(card => (
            <div key={card.label} style={{ background: card.color, color: "white", borderRadius: 10, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: "bold" }}>{card.value}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* By Ward */}
      {tab === "byWard" && summary && (
        <>
          <h3>Assets by Ward</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.byWard}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ward" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#06122b" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* By Department */}
      {tab === "byDepartment" && summary && (
        <>
          <h3>Assets by Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.byDepartment}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* By Type */}
      {tab === "byType" && summary && (
        <>
          <h3>Assets by Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summary.byType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Audit Log */}
      {tab === "audit" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead style={{ background: "#06122b", color: "white" }}>
              <tr>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Asset ID</th>
                <th style={styles.th}>By</th>
                <th style={styles.th}>Reason</th>
                <th style={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {audit.map(log => (
                <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={styles.td}>
                    <span style={{ background: actionColor(log.action), color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={styles.td}>{log.assetId}</td>
                  <td style={styles.td}>{log.changedBy}</td>
                  <td style={styles.td}>{log.reason || "-"}</td>
                  <td style={styles.td}>{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "userAudit" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead style={{ background: "#06122b", color: "white" }}>
              <tr>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>By</th>
                <th style={styles.th}>Note</th>
                <th style={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {userAudit.map(log => (
                <tr key={log.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={styles.td}>
                    <span style={{ background: log.action === "user_created" ? "#10b981" : log.action === "user_deleted" ? "#ef4444" : "#6366f1", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={styles.td}>{log.newData?.name || log.oldData?.name || log.userId}</td>
                  <td style={styles.td}>{log.changedByName || log.changedBy}</td>
                  <td style={styles.td}>{log.note || "-"}</td>
                  <td style={styles.td}>{log.timestamp ? new Date(log.timestamp).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
              {userAudit.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>No user audit records yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function actionColor(action) {
  const map = { created: "#16a34a", updated: "#2563eb", transfer: "#d97706", deleted: "#dc2626", restored: "#7c3aed" };
  return map[action] || "#6b7280";
}

const styles = {
  pdfBtn: { background: "#dc2626", color: "white", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: "bold" },
  xlsBtn: { background: "#16a34a", color: "white", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: "bold" },
  th: { padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 14 }
};
