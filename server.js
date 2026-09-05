"use strict";
const express = require("express");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

const authRoutes = require("./src/routes/auth");
const settingsRoutes = require("./src/routes/settings");
const employeeRoutes = require("./src/routes/employees");
const projectRoutes = require("./src/routes/projects");
const attendanceRoutes = require("./src/routes/attendance");
const materialRoutes = require("./src/routes/materials");
const stageRoutes = require("./src/routes/stages");
const quoteRoutes = require("./src/routes/quotes");
const changeOrderRoutes = require("./src/routes/changeOrders");

const app = express();
const PORT = process.env.PORT || 4173;

const SECRET_FILE = path.join(__dirname, "data", "session-secret.txt");
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true });
  if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, "utf8").trim();
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret, "utf8");
  return secret;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production" || !!process.env.RENDER;
if (IS_PRODUCTION) app.set("trust proxy", 1);

app.use(express.json({ limit: "2mb" }));
app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: IS_PRODUCTION,
    sameSite: "lax"
  }
}));

// Public auth endpoints (no login required)
app.use("/api", authRoutes);

// Everything else under /api requires login
app.use("/api", (req, res, next) => {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).json({ error: "Not authenticated" });
});

app.use("/api", settingsRoutes);
app.use("/api", employeeRoutes);
app.use("/api", projectRoutes);
app.use("/api", attendanceRoutes);
app.use("/api", materialRoutes);
app.use("/api", stageRoutes);
app.use("/api", quoteRoutes);
app.use("/api", changeOrderRoutes);

app.use("/api", (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Las Casita PM app running at http://localhost:" + PORT);
});
