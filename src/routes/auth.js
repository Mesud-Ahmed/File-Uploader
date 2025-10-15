// src/routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const prisma = require("../prismaClient");

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error_msg", "Please log in to view that resource");
  res.redirect("/login");
}

// ------------------
// Register
// ------------------
router.get("/register", (req, res) => {
res.render("register", { errors: [], email: "", password: "", password2: "" });
});

router.post("/register", async (req, res) => {
  const { email, password, password2 } = req.body;
  const errors = [];

  if (!email || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" });
  }
  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" });
  }
  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" });
  }

  if (errors.length > 0) {
    return res.render("register", { errors, email, password, password2 });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      errors.push({ msg: "Email already registered" });
      return res.render("register", { errors, email, password, password2 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    req.flash("success_msg", "You are now registered and can log in");
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Server error, please try again later");
    res.redirect("/register");
  }
});

// ------------------
// Login
// ------------------
router.get("/login", (req, res) => {
  res.render("login");
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })(req, res, next);
});

// ------------------
// Dashboard (protected)
// ------------------
router.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    // If logged in, show dashboard directly
    return res.render("dashboard", { user: req.user });
  } else {
    // Otherwise redirect to login
    return res.redirect("/login");
  }
});
router.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.render("dashboard", { user: req.user });
});

// ------------------
// Logout
// ------------------
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
      req.flash("error_msg", "Logout error");
      return res.redirect("/dashboard");
    }
    req.flash("success_msg", "You are logged out");
    res.redirect("/login");
  });
});

module.exports = router;
