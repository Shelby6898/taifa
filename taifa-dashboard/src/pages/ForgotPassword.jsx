import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email) { setError("Please enter your email address."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      setSubmitted(true);
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
        <p style={styles.sub}>Reset your password</p>
        {error && <p style={styles.error}>{error}</p>}
        {submitted ? (
          <>
            <p style={styles.message}>{message}</p>
            <p style={styles.hint}>Check your inbox for a reset link. It expires in 30 minutes.</p>
          </>
        ) : (
          <>
            <p style={styles.hint}>Enter your email and we will send you a link to reset your password.</p>
            <input style={styles.input} type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
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
  hint: { color: "#6b7280", margin: 0, fontSize: 13, lineHeight: 1.5 },
  input: { padding: "12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 15, outline: "none" },
  btn: { padding: "12px", background: "#06122b", color: "white", border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer", fontWeight: "bold" },
  backLink: { color: "#06122b", fontSize: 13, textAlign: "center", textDecoration: "none", marginTop: 2 }
};
