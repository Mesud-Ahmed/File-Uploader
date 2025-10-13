// src/index.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const flash = require("connect-flash");
const path = require("path");
const { PrismaSessionStore } = require("@quixo3/prisma-session-store");
const prisma = require("./prismaClient");
const expressLayouts = require("express-ejs-layouts");



const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(expressLayouts);
app.set("layout", "layout"); // default layout file


// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session with Prisma store
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret_change_me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000,
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);


app.use(flash());
require("./config/passport")(passport);
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error"); // for Passport errors
  res.locals.user = req.user || null;
  next();
});

// Routes
app.use("/", require("./routes/auth"));
app.use("/upload", require("./routes/upload"));
app.use("/folders", require("./routes/folders"));
app.use("/files", require("./routes/files"));

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
