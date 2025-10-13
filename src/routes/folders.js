// src/routes/folders.js
const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");
const path = require("path");
const fs = require("fs");

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error_msg", "Please log in first");
  return res.redirect("/login");
}

// List folders for logged-in user
router.get("/", ensureAuthenticated, async (req, res) => {
  const folders = await prisma.folder.findMany({
    where: { ownerId: req.user.id },
    include: { files: true },
    orderBy: { createdAt: "desc" },
  });
  res.render("folders", { folders });
});

// Show create form
router.get("/new", ensureAuthenticated, (req, res) => {
  res.render("newFolder");
});

// Create folder
router.post("/", ensureAuthenticated, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    req.flash("error_msg", "Folder name is required");
    return res.redirect("/folders/new");
  }

  await prisma.folder.create({
    data: {
      name,
      owner: { connect: { id: req.user.id } },
    },
  });

  req.flash("success_msg", "Folder created successfully!");
  res.redirect("/folders");
});

// Delete folder (with ownership check and file cleanup)
router.post("/:id/delete", ensureAuthenticated, async (req, res) => {
  const folderId = parseInt(req.params.id, 10);
  if (isNaN(folderId)) {
    req.flash("error_msg", "Invalid folder id");
    return res.redirect("/folders");
  }

  try {
    // Load folder and its files
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: { files: true },
    });

    if (!folder) {
      req.flash("error_msg", "Folder not found");
      return res.redirect("/folders");
    }

    // Ownership check
    if (folder.ownerId !== req.user.id) {
      req.flash("error_msg", "You do not have permission to delete this folder");
      return res.redirect("/folders");
    }

    // Delete files from disk (best-effort) and collect file ids
    const fileDeletePromises = folder.files.map(async (f) => {
      try {
        if (f.path) {
          // multer may give absolute or relative paths; handle both
          const filePath = path.isAbsolute(f.path) ? f.path : path.join(__dirname, "..", f.path);
          // unlink if exists
          try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            await fs.promises.unlink(filePath);
          } catch (err) {
            // file not found on disk — warn, but continue
            console.warn(`[folders.js] Could not delete file on disk: ${filePath}.`, err.message);
          }
        }
      } catch (err) {
        console.warn("[folders.js] error while removing file from disk:", err);
      }
    });

    await Promise.all(fileDeletePromises);

    // Delete file records from DB (all files in this folder)
    await prisma.file.deleteMany({ where: { folderId } });

    // Finally delete the folder
    await prisma.folder.delete({ where: { id: folderId } });

    req.flash("success_msg", "Folder and contained files deleted");
    return res.redirect("/folders");
  } catch (err) {
    console.error("Error deleting folder:", err);
    req.flash("error_msg", "Error deleting folder");
    return res.redirect("/folders");
  }
});

module.exports = router;
