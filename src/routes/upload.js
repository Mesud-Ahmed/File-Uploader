// src/routes/upload.js (instrumented)
const express = require("express");
const router = express.Router();
const multer = require("multer");
const prisma = require("../prismaClient");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Auth middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  req.flash("error_msg", "Please log in to upload files");
  return res.redirect("/login");
}

// Multer memory storage — ensures no disk writes
const storage = multer.memoryStorage();

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = [
  "image/jpeg","image/png","image/gif","application/pdf","text/plain"
];

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      const err = new Error("Invalid file type");
      err.code = "INVALID_TYPE";
      return cb(err);
    }
    cb(null, true);
  },
});

router.get("/", ensureAuthenticated, async (req, res) => {
  const folders = await prisma.folder.findMany({ where: { ownerId: req.user.id } });
  res.render("upload", { folders });
});

router.post("/", ensureAuthenticated, upload.single("file"), async (req, res) => {
  console.log("=== Upload POST hit ===");
  try {
    console.log("ENV Cloud:", {
      cloud: process.env.CLOUDINARY_CLOUD_NAME ? "SET" : "MISSING",
      key: process.env.CLOUDINARY_API_KEY ? "SET" : "MISSING",
    });

    const file = req.file;
    console.log("req.file:", !!file, file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer ? file.buffer.length : 0
    } : null);

    if (!file) {
      req.flash("error_msg", "Please select a file to upload");
      return res.redirect("/upload");
    }

    // Cloudinary upload
    const folderPrefix = process.env.CLOUDINARY_UPLOAD_FOLDER || "file_uploader";
    const userFolder = `user_${req.user.id}`;
    const targetFolder = `${folderPrefix}/${userFolder}`;

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: targetFolder, resource_type: "auto", use_filename: true, unique_filename: false },
        (error, result) => {
          if (error) {
            console.error("cloudinary upload_stream error:", error);
            return reject(error);
          }
          resolve(result);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    console.log("Cloudinary uploadResult:", {
      public_id: uploadResult.public_id,
      secure_url: uploadResult.secure_url,
      resource_type: uploadResult.resource_type,
    });

    // Save DB row
    const dbRow = await prisma.file.create({
      data: {
        filename: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: null,
        url: uploadResult.secure_url,
        cloudinaryPublicId: uploadResult.public_id,
        owner: { connect: { id: req.user.id } },
        folder: req.body.folderId ? { connect: { id: parseInt(req.body.folderId, 10) } } : undefined,
      },
    });

    console.log("DB file row created id:", dbRow.id);
    req.flash("success_msg", "Uploaded to Cloudinary");
    return res.redirect("/files");
  } catch (err) {
    console.error("Upload error (caught):", err);
    if (err.code === "LIMIT_FILE_SIZE") {
      req.flash("error_msg", `File too large (max ${MAX_BYTES / (1024*1024)} MB)`);
    } else if (err.code === "INVALID_TYPE" || err.message === "Invalid file type") {
      req.flash("error_msg", "Invalid file type");
    } else {
      req.flash("error_msg", "Upload failed; check server logs.");
    }
    return res.redirect("/upload");
  }
});

module.exports = router;
