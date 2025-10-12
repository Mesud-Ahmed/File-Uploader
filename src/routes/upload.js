const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const prisma = require("../prismaClient");

// Middleware to ensure user is logged in
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error_msg", "Please log in to upload files");
  res.redirect("/login");
}

// Configure Multer (local storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "uploads")); // uploads/ directory
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Upload page
router.get("/", ensureAuthenticated, (req, res) => {
  res.render("upload");
});

// Handle upload POST
router.post("/", ensureAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      req.flash("error_msg", "Please select a file to upload");
      return res.redirect("/upload");
    }

    await prisma.file.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
        owner: { connect: { id: req.user.id } },
      },
    });

    req.flash("success_msg", "File uploaded successfully!");
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Upload failed, please try again");
    res.redirect("/upload");
  }
});

module.exports = router;
