import { Link } from "react-router-dom";

export default function Welcome() {
  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <h1 style={styles.logo}>TAIFATECH</h1>
        <p style={styles.tagline}>
          Multi-Tenant Asset Management Platform
        </p>
        <p style={styles.subtext}>
          A cloud-based, multi-tenant asset management platform. Taifatech
          helps organisations — county governments, universities, NGOs,
          hospitals, and private companies — track, manage, and report on
          physical assets across departments and locations, replacing manual
          registers with a secure, role-based digital system accessible from
          any device.
        </p>
        <Link to="/login" style={styles.btn}>Sign In</Link>
      </header>

      <section style={styles.features}>
        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>🏛️</div>
          <h3 style={styles.featureTitle}>Full Asset Lifecycle</h3>
          <p style={styles.featureText}>
            From procurement to depreciation, every asset is tracked by
            ward, department, and value — with QR codes for quick lookup.
          </p>
        </div>

        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>🔁</div>
          <h3 style={styles.featureTitle}>Transfers & Audit Trail</h3>
          <p style={styles.featureText}>
            Asset transfers require approval and are logged automatically,
            so there's always a clear record of who approved what, and when.
          </p>
        </div>

        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>📊</div>
          <h3 style={styles.featureTitle}>Reports That Hold Up</h3>
          <p style={styles.featureText}>
            Export branded PDF and Excel reports by ward, department, or
            asset type — ready to share with leadership or auditors.
          </p>
        </div>

        <div style={styles.featureCard}>
          <div style={styles.featureIcon}>🏢</div>
          <h3 style={styles.featureTitle}>Built for Many Organisations</h3>
          <p style={styles.featureText}>
            Each organisation gets its own branding, users, and data —
            fully isolated, on one secure platform.
          </p>
        </div>
      </section>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Already have an account? <Link to="/login" style={styles.footerLink}>Sign in here</Link>
        </p>
      </footer>
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
    padding: "16px",
  },
  hero: {
    width: "100%",
    maxWidth: 720,
    textAlign: "center",
    padding: "64px 16px 48px",
  },
  logo: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "bold",
    margin: 0,
    letterSpacing: 1,
  },
  tagline: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 600,
    margin: "16px 0 12px",
  },
  subtext: {
    color: "#94a3b8",
    fontSize: 15,
    lineHeight: 1.7,
    margin: "0 0 36px",
    maxWidth: 580,
    marginLeft: "auto",
    marginRight: "auto",
  },
  btn: {
    display: "inline-block",
    padding: "14px 40px",
    background: "#ffffff",
    color: "#06122b",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "bold",
    textDecoration: "none",
  },
  features: {
    width: "100%",
    maxWidth: 960,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 20,
    padding: "24px 0 56px",
  },
  featureCard: {
    background: "#0d1b3d",
    border: "1px solid #1e2f5c",
    borderRadius: 12,
    padding: "24px 20px",
    textAlign: "left",
  },
  featureIcon: {
    fontSize: 28,
    marginBottom: 12,
  },
  featureTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 700,
    margin: "0 0 8px",
  },
  featureText: {
    color: "#94a3b8",
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },
  footer: {
    padding: "24px 16px 48px",
    textAlign: "center",
  },
  footerText: {
    color: "#64748b",
    fontSize: 14,
    margin: 0,
  },
  footerLink: {
    color: "#ffffff",
    fontWeight: 600,
    textDecoration: "underline",
  },
};
