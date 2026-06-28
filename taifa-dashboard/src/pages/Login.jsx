import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [form, setForm] = useState({ email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const [error, setError] = useState(
    location.state?.reason === "inactivity"
      ? "You were logged out due to inactivity. Please sign in again."
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [use2FA, setUse2FA] = useState(false);

  // Step 1 — standard login or trigger 2FA
  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (use2FA) {
        // 2FA flow — send OTP
        const res = await api.post("/otp/login", form);
        if (res.data.requires2FA) {
          setOtpPhone(res.data.phone);
          setStep("otp");
        }
      } else {
        // Standard login
        const res = await api.post("/auth/login", form);
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/otp/verify-login", {
        phone: otpPhone,
        otp
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TAIFATECH</h1>
        <p style={styles.sub}>Taifa Asset Management System</p>

        {error && <p style={styles.error}>{error}</p>}

        {step === "credentials" && (
          <>
            <input
              style={styles.input}
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />

            {/* 2FA toggle */}
            <div style={styles.toggleRow}>
              <label style={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={use2FA}
                  onChange={e => setUse2FA(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Use 2FA (SMS verification)
              </label>
            </div>

            <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
              {loading ? "Signing in..." : use2FA ? "Send Verification Code" : "Sign In"}
            </button>
            <Link to="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
          </>
        )}

        {step === "otp" && (
          <>
            <div style={styles.otpInfo}>
              <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
                A 6-digit verification code was sent to
              </p>
              <p style={{ margin: "4px 0 0", fontWeight: 700, color: "#06122b" }}>
                {otpPhone}
              </p>
            </div>

            <input
              style={{ ...styles.input, textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: "bold" }}
              type="number"
              placeholder="000000"
              value={otp}
              maxLength={6}
              onChange={e => setOtp(e.target.value.slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleVerifyOTP()}
            />

            <button style={styles.btn} onClick={handleVerifyOTP} disabled={loading}>
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <button
              style={styles.backBtn}
              onClick={() => { setStep("credentials"); setOtp(""); setError(""); }}
            >
              ← Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#06122b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16
  },
  card: {
    background: "white",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 380,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 4px 24px rgba(0,0,0,0.2)"
  },
  logo: { margin: 0, fontSize: 32, fontWeight: "bold", color: "#06122b" },
  sub: { margin: 0, color: "#6b7280", fontSize: 14 },
  error: { color: "#dc2626", margin: 0, fontSize: 14 },
  input: {
    padding: "12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 15,
    outline: "none"
  },
  btn: {
    padding: "12px",
    background: "#06122b",
    color: "white",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer",
    fontWeight: "bold"
  },
  backBtn: {
    padding: "10px",
    background: "transparent",
    color: "#6b7280",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer"
  },
  forgotLink: {
    color: "#06122b",
    fontSize: 13,
    textAlign: "center",
    textDecoration: "none",
    marginTop: 2
  },
  toggleRow: {
    display: "flex",
    alignItems: "center"
  },
  toggleLabel: {
    fontSize: 13,
    color: "#374151",
    cursor: "pointer",
    display: "flex",
    alignItems: "center"
  },
  otpInfo: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 8,
    padding: "12px 16px",
    textAlign: "center"
  }
};
