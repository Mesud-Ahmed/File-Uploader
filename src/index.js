// src/index.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const prisma = require("./prismaClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "dev_secret_change_me",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

app.use(passport.initialize());
app.use(passport.session());

// Basic test route
app.get("/", (req, res) => {
  res.send("File Uploader API — running with Postgres DB");
});

// Check DB connectivity
app.get("/health", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() AS current_time`;
    res.json({ ok: true, db_time: result[0].current_time });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
