import { useEffect, useState } from "react";
import { api } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";

const conditionColor = (c) => ({
  "Excellent": "#16a34a",
  "Good": "#2563eb",
  "Fair": "#d97706",
  "Poor": "#dc2626",
  "Fully Depreciated": "#6b7280"
}[c] || "#6b7280");

export default function Depreciation() {
  const [report, setReport] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetDetail, setAssetDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState("overview");
  const [message, setMessage] = useState("");

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    try {
      const res = await api.get("/depreciation");
      setReport(res.data.data);
      setSummary(res.data.summary);
    } catch (err) {
      setMessage("❌ " + (err.response?.data?.message || "Failed to load depreciation data"));
    } finally {
      setLoading(false);
    }
  };

  const loadAssetDetail = async (asset) => {
    setSelectedAsset(asset);
    setDetailLoading(true);
    try {
      const res = await api.get(`/depreciation/${asset.assetId}`);
      setAssetDetail(res.data.data);
    } catch (err) {
      setMessage("❌ Failed to load asset detail");
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <p style={{ padding: 20 }}>Loading depreciation data...</p>;

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: 0 }}>📉 Asset Depreciation</h2>

      {message && <p style={{ color: "#dc2626", marginTop: 8 }}>{message}</p>}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 16 }}>
          {[
            { label: "Original Value", value: `KES ${summary.totalOriginalValue.toLocaleString()}`, color: "#06122b" },
            { label: "Current Value", value: `KES ${summary.totalCurrentValue.toLocaleString()}`, color: "#2563eb" },
            { label: "Total Depreciated", value: `KES ${summary.totalDepreciated.toLocaleString()}`, color: "#dc2626" },
            { label: "Annual Cost", value: `KES ${summary.annualDepreciationCost.toLocaleString()}`, color: "#d97706" }
          ].map(c => (
            <div key={c.label} style={{ background: c.color, color: "white", borderRadius: 10, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: "bold" }}>{c.value}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Condition Summary */}
      {summary && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {[
            { label: "Excellent", value: summary.excellent, color: "#16a34a" },
            { label: "Good", value: summary.good, color: "#2563eb" },
            { label: "Fair", value: summary.fair, color: "#d97706" },
            { label: "Poor", value: summary.poor, color: "#dc2626" },
            { label: "Fully Depr.", value: summary.fullyDepreciated, color: "#6b7280" }
          ].map(c => (
            <div key={c.label} style={{ background: c.color, color: "white", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
              <strong>{c.value}</strong> {c.label}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {["overview", "chart"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13,
            background: tab === t ? "#06122b" : "#e5e7eb",
            color: tab === t ? "white" : "#333"
          }}>
            {t === "overview" ? "Asset List" : "Value Chart"}
          </button>
        ))}
      </div>

      {/* Chart Tab */}
      {tab === "chart" && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 12px" }}>Original vs Current Value by Asset</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => `KES ${v.toLocaleString()}`} />
              <Bar dataKey="originalValue" name="Original Value" fill="#06122b" />
              <Bar dataKey="currentValue" name="Current Value" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset List Tab */}
      {tab === "overview" && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {report.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No assets found.</p>
          ) : report.map(asset => (
            <div key={asset.assetId} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, borderLeft: `4px solid ${conditionColor(asset.condition)}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong>{asset.name}</strong>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{asset.assetCode}</span>
                    <span style={{ background: conditionColor(asset.condition), color: "white", fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: "bold" }}>
                      {asset.condition}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>🏷️ {asset.type}</span>
                    <span>🏢 {asset.department}</span>
                    <span>⏱️ {asset.ageYears}y old</span>
                  </div>

                  {/* Depreciation Bar */}
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>Depreciated: {asset.depreciationPercent}%</span>
                      <span>Remaining life: {asset.remainingLifeYears}y</span>
                    </div>
                    <div style={{ background: "#e5e7eb", borderRadius: 4, height: 8 }}>
                      <div style={{ background: conditionColor(asset.condition), height: 8, borderRadius: 4, width: `${Math.min(100, asset.depreciationPercent)}%` }} />
                    </div>
                  </div>

                  <div style={{ fontSize: 13, marginTop: 8, display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span>💰 Original: <strong>KES {asset.originalValue.toLocaleString()}</strong></span>
                    <span>📉 Current: <strong style={{ color: conditionColor(asset.condition) }}>KES {asset.currentValue.toLocaleString()}</strong></span>
                    <span>📆 Annual: KES {asset.annualDepreciation.toLocaleString()}/yr</span>
                  </div>
                </div>
                <button style={{ background: "#06122b", color: "white", border: "none", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13, flexShrink: 0 }}
                  onClick={() => loadAssetDetail(asset)}>
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{selectedAsset.name} — Depreciation</h3>
              <button onClick={() => { setSelectedAsset(null); setAssetDetail(null); }} style={{ background: "#e5e7eb", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}>✕</button>
            </div>

            {detailLoading ? <p>Loading...</p> : assetDetail && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Original Value", value: `KES ${assetDetail.originalValue.toLocaleString()}` },
                    { label: "Current Value", value: `KES ${assetDetail.currentValue.toLocaleString()}` },
                    { label: "Depreciation Rate", value: `${assetDetail.depreciationRate}%/yr` },
                    { label: "Monthly Cost", value: `KES ${assetDetail.monthlyDepreciation.toLocaleString()}` },
                    { label: "Age", value: `${assetDetail.ageYears} years` },
                    { label: "Remaining Life", value: `${assetDetail.remainingLifeYears} years` }
                  ].map(item => (
                    <div key={item.label} style={{ background: "#f9fafb", borderRadius: 8, padding: 10 }}>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 2 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <h4 style={{ margin: "0 0 10px" }}>📅 Year-by-Year Breakdown</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 380 }}>
                    <thead style={{ background: "#06122b", color: "white" }}>
                      <tr>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Year</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Opening</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Depr.</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Closing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assetDetail.yearlyBreakdown.map(row => (
                        <tr key={row.year} style={{ borderBottom: "1px solid #e5e7eb", background: row.closingValue === 0 ? "#fef2f2" : "white" }}>
                          <td style={{ padding: "8px 10px" }}>{row.calendarYear}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>KES {row.openingValue.toLocaleString()}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#dc2626" }}>-KES {row.depreciation.toLocaleString()}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: "bold" }}>KES {row.closingValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mini chart */}
                <h4 style={{ margin: "16px 0 10px" }}>Value Over Time</h4>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={assetDetail.yearlyBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="calendarYear" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `KES ${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="closingValue" stroke="#2563eb" name="Book Value" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
