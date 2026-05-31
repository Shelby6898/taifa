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

app.use(express.static(
  path.join(__dirname, "public")
));

/*
|--------------------------------------------------------------------------
| Root Route
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    application: "Taifa County Asset Manager",
    version: "1.0.0",
    environment: NODE_ENV,
    message: "Welcome to Taifa API",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      assets: "/api/assets",
      transfers: "/api/transfers",
      maintenance: "/api/maintenance",
      reports: "/api/reports"
    }
  });
});

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
app.use("/api/tickets",  require("./src/routes/comments"));
app.use("/api",         require("./src/routes/admin"));
app.use("/api/export",   require("./src/routes/export"));

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
🚀 TAIFA COUNTY ASSET MANAGER API
==================================================
Environment : ${NODE_ENV}
Server URL  : http://localhost:${PORT}
Health Check: http://localhost:${PORT}/api/health
Started At  : ${new Date().toLocaleString()}
==================================================
`);
});
// This will be ignored as it's after app.listen - we need to insert it properly
