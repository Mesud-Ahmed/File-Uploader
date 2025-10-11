// src/index.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const prisma = require("./prismaClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Configure session with Prisma store
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, // every 2 mins clear expired sessions
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

// ✅ Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Simple route for now
app.get("/", (req, res) => {
  res.send("✅ File Uploader with PostgreSQL + Prisma Session Store is running!");
});

// DB check route
app.get("/health", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW() AS current_time`;
    res.json({ ok: true, db_time: result[0].current_time });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
