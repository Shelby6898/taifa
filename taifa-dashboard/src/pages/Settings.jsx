import { useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const user    = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  // Profile state
  const [profile, setProfile]   = useState({ name: "", email: "" });
  const [passwords, setPasswords] = useState({ current: "", newPass: "", confirm: "" });
  const [profileMsg, setProfileMsg] = useState("");
  const [passMsg,    setPassMsg]    = useState("");

  // System settings state (admin only)
  const [slaTargets, setSlaTargets] = useState({
    urgent: { response: 60,   resolution: 240  },
    high:   { response: 240,  resolution: 480  },
    medium: { response: 480,  resolution: 1440 },
    low:    { response: 1440, resolution: 4320 },
  });
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [assetTypes,  setAssetTypes]  = useState([]);
  const [departments, setDepartments] = useState([]);
  const [newType,     setNewType]     = useState("");
  const [newDept,     setNewDept]     = useState("");
  const [sysMsg,      setSysMsg]      = useState("");
  const [activeTab,   setActiveTab]   = useState("profile");

  useEffect(() => { loadProfile(); if (isAdmin) loadSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    try {
      const res = await api.get("/auth/profile");
      setProfile({ name: res.data.data.name, email: res.data.data.email });
    } catch (e) {}
  }

  async function loadSettings() {
    try {
      const res = await api.get("/settings");
      const d   = res.data.data;
      setSlaTargets(d.slaTargets);
      setEmailNotifications(d.emailNotifications);
      setAssetTypes(d.assetTypes || []);
      setDepartments(d.departments || []);
    } catch (e) {}
  }

  async function saveProfile() {
    try {
      await api.put("/auth/profile", profile);
      setProfileMsg("✅ Profile updated successfully!");
      // Update localStorage
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem("user", JSON.stringify({ ...u, name: profile.name, email: profile.email }));
    } catch (err) {
      setProfileMsg("❌ " + (err.response?.data?.message || "Failed to update profile"));
    }
  }

  async function changePassword() {
    if (!passwords.current || !passwords.newPass) return setPassMsg("❌ Please fill all fields.");
    if (passwords.newPass !== passwords.confirm) return setPassMsg("❌ Passwords do not match.");
    if (passwords.newPass.length < 6) return setPassMsg("❌ Password must be at least 6 characters.");
    try {
      await api.put("/auth/profile/password", {
        currentPassword: passwords.current,
        newPassword: passwords.newPass
      });
      setPassMsg("✅ Password changed successfully!");
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      setPassMsg("❌ " + (err.response?.data?.message || "Failed to change password"));
    }
  }

  async function saveSettings() {
    try {
      await api.put("/settings", { slaTargets, emailNotifications, assetTypes, departments });
      setSysMsg("✅ Settings saved successfully!");
    } catch (err) {
      setSysMsg("❌ " + (err.response?.data?.message || "Failed to save settings"));
    }
  }

  function updateSLA(priority, field, value) {
    setSlaTargets(prev => ({
      ...prev,
      [priority]: { ...prev[priority], [field]: Number(value) }
    }));
  }

  const tabs = [
    { key: "profile",  label: "👤 Profile" },
    { key: "password", label: "🔒 Password" },
    ...(isAdmin ? [
      { key: "sla",    label: "⏱️ SLA Targets" },
      { key: "system", label: "⚙️ System" },
    ] : []),
  ];

  const s = {
    wrap:    { padding: "20px 16px", fontFamily: "sans-serif", maxWidth: 600 },
    title:   { fontSize: 20, fontWeight: 700, color: "#1e293b", marginBottom: 4 },
    sub:     { fontSize: 13, color: "#64748b", marginBottom: 20 },
    tabs:    { display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" },
    tab:     (active) => ({
      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
      fontWeight: 600, fontSize: 13,
      background: active ? "#1e293b" : "#f1f5f9",
      color: active ? "#fff" : "#64748b"
    }),
    card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, marginBottom: 16 },
    label:   { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5, textTransform: "uppercase" },
    input:   { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 },
    btn:     (c="#1e293b") => ({ padding: "10px 20px", background: c, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }),
    msg:     (ok) => ({ padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
      background: ok ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
      color: ok ? "#166534" : "#991b1b" }),
    row:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" },
    badge:   { background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "#1e293b" },
    slaRow:  { display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, alignItems: "center", marginBottom: 10 },
    slaLabel:{ fontSize: 12, fontWeight: 700, textTransform: "capitalize" },
    tagWrap: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    tag:     (c="#6366f1") => ({ background: c+"15", color: c, border: `1px solid ${c}33`, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }),
    addRow:  { display: "flex", gap: 8, marginTop: 8 },
  };

  return (
    <div style={s.wrap}>
      <div style={s.title}>⚙️ Settings</div>
      <div style={s.sub}>Manage your profile and system preferences</div>

      {/* Tabs */}
      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={s.tab(activeTab === t.key)} onClick={() => { setActiveTab(t.key); setProfileMsg(""); setPassMsg(""); setSysMsg(""); }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* PROFILE TAB */}
      {activeTab === "profile" && (
        <div style={s.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>👤 Profile Information</h3>
          {profileMsg && <div style={s.msg(profileMsg.includes("✅"))}>{profileMsg}</div>}

          <label style={s.label}>Full Name</label>
          <input style={s.input} value={profile.name}
            onChange={e => setProfile({ ...profile, name: e.target.value })} />

          <label style={s.label}>Email Address</label>
          <input style={s.input} type="email" value={profile.email}
            onChange={e => setProfile({ ...profile, email: e.target.value })} />

          <div style={s.row}>
            <span style={{ fontSize: 13, color: "#64748b" }}>Role</span>
            <span style={s.badge}>{user.role}</span>
          </div>
          <div style={{ ...s.row, borderBottom: "none" }}>
            <span style={{ fontSize: 13, color: "#64748b" }}>Department</span>
            <span style={s.badge}>{user.department || "—"}</span>
          </div>

          <button style={{ ...s.btn(), marginTop: 16 }} onClick={saveProfile}>
            Save Profile
          </button>
        </div>
      )}

      {/* PASSWORD TAB */}
      {activeTab === "password" && (
        <div style={s.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>🔒 Change Password</h3>
          {passMsg && <div style={s.msg(passMsg.includes("✅"))}>{passMsg}</div>}

          <label style={s.label}>Current Password</label>
          <input style={s.input} type="password" value={passwords.current}
            onChange={e => setPasswords({ ...passwords, current: e.target.value })} />

          <label style={s.label}>New Password</label>
          <input style={s.input} type="password" value={passwords.newPass}
            onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} />

          <label style={s.label}>Confirm New Password</label>
          <input style={s.input} type="password" value={passwords.confirm}
            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />

          <button style={s.btn("#6366f1")} onClick={changePassword}>
            Change Password
          </button>
        </div>
      )}

      {/* SLA TARGETS TAB (admin only) */}
      {activeTab === "sla" && isAdmin && (
        <div style={s.card}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#1e293b" }}>⏱️ SLA Targets</h3>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Set response and resolution time targets in minutes for each priority level.</p>
          {sysMsg && <div style={s.msg(sysMsg.includes("✅"))}>{sysMsg}</div>}

          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>PRIORITY</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>RESPONSE (mins)</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>RESOLUTION (mins)</div>
          </div>

          {["urgent","high","medium","low"].map(p => (
            <div key={p} style={s.slaRow}>
              <div style={{ ...s.slaLabel, color: { urgent:"#dc2626", high:"#ef4444", medium:"#f59e0b", low:"#10b981" }[p] }}>
                {p}
              </div>
              <input style={{ ...s.input, marginBottom: 0 }} type="number"
                value={slaTargets[p]?.response || ""}
                onChange={e => updateSLA(p, "response", e.target.value)} />
              <input style={{ ...s.input, marginBottom: 0 }} type="number"
                value={slaTargets[p]?.resolution || ""}
                onChange={e => updateSLA(p, "resolution", e.target.value)} />
            </div>
          ))}

          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            💡 Common values: 60 = 1 hour, 480 = 8 hours, 1440 = 24 hours, 4320 = 72 hours
          </div>

          <button style={s.btn("#6366f1")} onClick={saveSettings}>Save SLA Targets</button>
        </div>
      )}

      {/* SYSTEM TAB (admin only) */}
      {activeTab === "system" && isAdmin && (
        <>
          {sysMsg && <div style={s.msg(sysMsg.includes("✅"))}>{sysMsg}</div>}

          {/* Email Notifications */}
          <div style={s.card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>📧 Notifications</h3>
            <div style={s.row}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Email Notifications</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>Send email alerts for transfers, tickets and maintenance</div>
              </div>
              <div
                onClick={() => setEmailNotifications(!emailNotifications)}
                style={{
                  width: 44, height: 24, borderRadius: 12, cursor: "pointer",
                  background: emailNotifications ? "#10b981" : "#e2e8f0",
                  position: "relative", transition: "background 0.2s"
                }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2,
                  left: emailNotifications ? 22 : 2,
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }}/>
              </div>
            </div>
            <button style={{ ...s.btn("#6366f1"), marginTop: 12 }} onClick={saveSettings}>Save</button>
          </div>

          {/* Asset Types */}
          <div style={s.card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>🏷️ Asset Types</h3>
            <div style={s.tagWrap}>
              {assetTypes.map(t => (
                <div key={t} style={s.tag("#6366f1")}>
                  {t}
                  <span style={{ cursor: "pointer", fontWeight: 900, fontSize: 14, color: "#ef4444" }}
                    onClick={() => setAssetTypes(assetTypes.filter(x => x !== t))}>×</span>
                </div>
              ))}
            </div>
            <div style={s.addRow}>
              <input style={{ ...s.input, marginBottom: 0, flex: 1 }}
                placeholder="New asset type…" value={newType}
                onChange={e => setNewType(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newType.trim()) { setAssetTypes([...assetTypes, newType.trim()]); setNewType(""); }}} />
              <button style={s.btn("#10b981")} onClick={() => { if (newType.trim()) { setAssetTypes([...assetTypes, newType.trim()]); setNewType(""); }}}>Add</button>
            </div>
            <button style={{ ...s.btn("#6366f1"), marginTop: 12 }} onClick={saveSettings}>Save Asset Types</button>
          </div>

          {/* Departments */}
          <div style={s.card}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#1e293b" }}>🏢 Departments</h3>
            <div style={s.tagWrap}>
              {departments.map(d => (
                <div key={d} style={s.tag("#f59e0b")}>
                  {d}
                  <span style={{ cursor: "pointer", fontWeight: 900, fontSize: 14, color: "#ef4444" }}
                    onClick={() => setDepartments(departments.filter(x => x !== d))}>×</span>
                </div>
              ))}
            </div>
            <div style={s.addRow}>
              <input style={{ ...s.input, marginBottom: 0, flex: 1 }}
                placeholder="New department…" value={newDept}
                onChange={e => setNewDept(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(""); }}} />
              <button style={s.btn("#10b981")} onClick={() => { if (newDept.trim()) { setDepartments([...departments, newDept.trim()]); setNewDept(""); }}}>Add</button>
            </div>
            <button style={{ ...s.btn("#6366f1"), marginTop: 12 }} onClick={saveSettings}>Save Departments</button>
          </div>
        </>
      )}
    </div>
  );
}
