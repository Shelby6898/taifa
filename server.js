require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

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

/*
|--------------------------------------------------------------------------
| Static Frontend (Production)
|--------------------------------------------------------------------------
*/
const buildPath = path.join(__dirname, "taifa-dashboard/build");
app.use(express.static(buildPath));
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/assets/view")) return next();
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
