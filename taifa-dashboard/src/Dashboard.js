import { useEffect, useState } from "react";
import { api } from "./api";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function Dashboard() {
  const [monthly, setMonthly] = useState([]);
  const [deptTrend, setDeptTrend] = useState([]);
  const [topAssets, setTopAssets] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [m, d, t] = await Promise.all([
      api.get("/assets/analytics/monthly-acquisitions"),
      api.get("/assets/analytics/department-monthly-trends"),
      api.get("/assets/analytics/top-value?limit=5")
    ]);

    setMonthly(m.data.data);
    setDeptTrend(d.data.data);
    setTopAssets(t.data.data);
  };

  const departments =
    deptTrend.length > 0
      ? Object.keys(deptTrend[0]).filter(k => k !== "month")
      : [];

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h2>📊 Taifa Asset Dashboard</h2>

      {/* TOP ASSETS */}
      <h3>💰 Top Assets</h3>
      <ul>
        {topAssets.map(a => (
          <li key={a.assetId}>
            {a.name} - KES {a.value}
          </li>
        ))}
      </ul>

      {/* MONTHLY CHART */}
      <h3>📈 Monthly Acquisitions</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={monthly}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>

      {/* DEPARTMENT TREND */}
      <h3>🏢 Department Trends</h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={deptTrend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />

          {departments.map((dept, i) => (
            <Bar key={dept} dataKey={dept} fill={`hsl(${i * 60},70%,50%)`} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
