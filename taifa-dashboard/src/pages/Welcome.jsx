import { Link } from "react-router-dom";

export default function Welcome() {
  return (
    <div style={styles.page}>
      <h1 style={styles.logo}>TAIFATECH</h1>
      <p style={styles.tagline}>Multi-Tenant Asset Management Platform</p>
      <Link to="/login" style={styles.btn}>Sign In</Link>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#06122b",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    textAlign: "center"
  },
  logo: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
    margin: 0,
    letterSpacing: 1
  },
  tagline: {
    color: "#94a3b8",
    fontSize: 16,
    margin: "12px 0 36px"
  },
  btn: {
    display: "inline-block",
    padding: "14px 40px",
    background: "#ffffff",
    color: "#06122b",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    textDecoration: "none"
  }
};
