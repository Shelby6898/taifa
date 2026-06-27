require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
app.set("trust proxy", 2); // trust exactly 2 hops: Cloudflare + Render internal LB

/*
|--------------------------------------------------------------------------
| App Configuration
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 4000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const NODE_ENV = process.env.NODE_ENV || "development";

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());
app.use(morgan(":req[x-forwarded-for] - :remote-user [:date[clf]] \":method :url HTTP/:http-version\" :status :res[content-length] \":referrer\" \":user-agent\""));

// General rate limit - applies to all routes, protects against scraping/DoS abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                 // 200 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again later." }
});

// Strict rate limit for login - protects against brute-force password guessing
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,                   // 8 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts against the limit
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." }
});

// Rate limit for forgot-password - prevents spamming reset emails to a target inbox
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,                   // 3 reset requests per IP per window (no skipSuccessfulRequests - every attempt counts)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many password reset requests. Please try again in 15 minutes." }
});

app.use(generalLimiter);

app.use(express.json({
  limit: "10mb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "10mb"
}));

/*
|--------------------------------------------------------------------------
| Static Files
|--------------------------------------------------------------------------
*/

app.use(express.static(path.join(__dirname, "taifa-dashboard/build")));

/*
|--------------------------------------------------------------------------
| Root Route
|--------------------------------------------------------------------------
*/

// Root served by static files above
/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    application: "Taifa County Asset Manager",
    status: "running",
    serverTime: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

app.use(
  "/api/auth/login",
  loginLimiter
);

app.use(
  "/api/auth/forgot-password",
  forgotPasswordLimiter
);

app.use(
  "/api/auth",
  require("./src/routes/auth")
);

app.use("/assets/view", require("./src/routes/publicAssets"));
app.use(
  "/api/assets",
  require("./src/routes/assets")
);

app.use(
  "/api/transfers",
  require("./src/routes/transfers")
);

app.use("/api/notifications", require("./src/routes/notifications"));
app.use("/api/depreciation", require("./src/routes/depreciation"));
app.use("/api/categories", require("./src/routes/categories"));
app.use("/api/disposals", require("./src/routes/disposals"));

app.use(
  "/api/maintenance",
  require("./src/routes/maintenance")
);

app.use(
  "/api/reports",
  require("./src/routes/reports")
);

/*
|--------------------------------------------------------------------------
| ICT Helpdesk Module
|--------------------------------------------------------------------------
*/
app.use("/api/tickets",  require("./src/routes/tickets"));
app.use("/api/settings", require("./src/routes/settings"));
app.use("/api/tickets/:id/comments", require("./src/routes/comments"));
app.use("/api",         require("./src/routes/admin"));
app.use("/api/export",   require("./src/routes/export"));
app.use("/api/backup", require("./src/routes/backup"));
app.use("/api/organizations", require("./src/routes/organizations"));

/*
|--------------------------------------------------------------------------
| Static Frontend (Production)
|--------------------------------------------------------------------------
*/
const buildPath = path.join(__dirname, "taifa-dashboard/build");
app.use(express.static(buildPath));
// Common scanner/bot probe patterns - reject straight to 404 instead of
// serving the React app shell (keeps logs clean and avoids wasted bandwidth)
const BOT_PROBE_PATTERNS = [
  /^\/wp-/i,           // wp-admin, wp-login, wp-content, etc.
  /^\/xmlrpc\.php/i,
  /^\/\.env/i,
  /^\/\.git/i,
  /^\/phpmyadmin/i,
  /^\/admin\.php/i,
  /^\/config\.php/i,
];

app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/assets/view")) return next();
  if (BOT_PROBE_PATTERNS.some(pattern => pattern.test(req.path))) return next();
  const indexPath = path.join(buildPath, "index.html");
  require("fs").existsSync(indexPath) ? res.sendFile(indexPath) : next();
});
/*
|--------------------------------------------------------------------------
| 404 Route Handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error("SERVER ERROR");
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      NODE_ENV === "development"
        ? err.message
        : undefined
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`
==================================================
🚀 TAIFATECH ASSET MANAGER API
==================================================
Environment : ${NODE_ENV}
Server URL  : ${BASE_URL}
Health Check: ${BASE_URL}/api/health
Started At  : ${new Date().toLocaleString()}
==================================================
`);
});
// This will be ignored as it's after app.listen - we need to insert it properly
