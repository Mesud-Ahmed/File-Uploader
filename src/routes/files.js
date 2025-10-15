// src/routes/files.js
const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const path = require("path");
const fs = require("fs");

const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.flash("error_msg", "Please log in first.");
  res.redirect("/login");
};

// ---- NEW: List all files for the logged-in user (optionally filter by folderId)
// GET /files?folderId=123
router.get("/", ensureAuth, async (req, res) => {
  try {
    const folderId = req.query.folderId ? parseInt(req.query.folderId, 10) : undefined;
    if (req.query.folderId && isNaN(folderId)) {
      req.flash("error_msg", "Invalid folder id");
      return res.redirect("/dashboard");
    }

    const where = {
      ownerId: req.user.id,
      ...(folderId ? { folderId } : {}),
    };

    const files = await prisma.file.findMany({
      where,
      include: { folder: true },
      orderBy: { createdAt: "desc" },
      take: 200, // safety cap
    });

    res.render("files", { title: "Your Files", files });
  } catch (err) {
    console.error("Error fetching files:", err);
    req.flash("error_msg", "Could not load files");
    res.redirect("/dashboard");
  }
});

// 🧾 View file details
router.get("/:id", ensureAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    if (isNaN(fileId)) {
      req.flash("error_msg", "Invalid file id");
      return res.redirect("/files");
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { owner: true, folder: true },
    });

    if (!file || file.ownerId !== req.user.id) {
      req.flash("error_msg", "File not found or access denied.");
      return res.redirect("/files");
    }

    res.render("file-details", {
      title: "File Details",
      file,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Error fetching file details.");
    res.redirect("/files");
  }
});

// ⬇ Download file
// ⬇ Download file
router.get("/:id/download", ensureAuth, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id, 10);
    if (isNaN(fileId)) {
      req.flash("error_msg", "Invalid file id");
      return res.redirect("/files");
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.ownerId !== req.user.id) {
      req.flash("error_msg", "File not found or access denied.");
      return res.redirect("/files");
    }

    // If we have a cloud URL, redirect (Cloudinary serves the file)
    if (file.url) {
      return res.redirect(file.url);
    }

    // Otherwise fall back to local file download
    const filePath = path.isAbsolute(file.path)
      ? file.path
      : path.join(__dirname, "..", file.path);

    if (!fs.existsSync(filePath)) {
      req.flash("error_msg", "File not found on server.");
      return res.redirect("/files");
    }

    res.download(filePath, file.originalName);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Error downloading file.");
    res.redirect("/files");
  }
});

module.exports = router;
