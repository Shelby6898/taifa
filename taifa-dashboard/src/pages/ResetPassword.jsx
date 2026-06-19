import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is missing or invalid.");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) { setError("Please fill in both fields."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.logo}>TAIFATECH</h1>
        <p style={styles.sub}>Set a new password</p>
        {error && <p style={styles.error}>{error}</p>}
        {success ? (
          <p style={styles.message}>Password reset successfully. Redirecting to sign in...</p>
        ) : token && (
          <>
            <input style={styles.input} type="password" placeholder="New password"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <input style={styles.input} type="password" placeholder="Confirm new password"
              value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        )}
        <Link to="/login" style={styles.backLink}>Back to Sign In</Link>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "#06122b", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { background: "white", borderRadius: 12, padding: 32, width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.2)" },
  logo: { margin: 0, fontSize: 32, fontWeight: "bold", color: "#06122b" },
  sub: { margin: 0, color: "#6b7280", fontSize: 14 },
  error: { color: "#dc2626", margin: 0, fontSize: 14 },
  message: { color: "#0d9488", margin: 0, fontSize: 15, fontWeight: 600 },
  input: { padding: "12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, outline: "none" },
  btn: { padding: "12px", background: "#06122b", color: "white", border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer", fontWeight: "bold" },
  backLink: { color: "#06122b", fontSize: 13, textAlign: "center", textDecoration: "none", marginTop: 2 }
};
