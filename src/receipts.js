"use strict";
const multer = require("multer");
const path = require("path");
const db = require("./db");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype) || file.mimetype === "application/pdf";
    cb(ok ? null : new Error("Only image or PDF files are allowed"), ok);
  }
}).single("file");

function guessExt(mimetype) {
  if (mimetype === "application/pdf") return ".pdf";
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/heic" || mimetype === "image/heif") return ".heic";
  if (mimetype === "image/webp") return ".webp";
  return ".jpg";
}

// Uploads a new receipt file, replacing (and deleting) any previous one for this record.
async function uploadReceipt(collection, id, file, existingPath) {
  const ext = (path.extname(file.originalname || "") || guessExt(file.mimetype)).toLowerCase();
  const storagePath = collection + "/" + id + "-" + Date.now() + ext;
  const { error: uploadError } = await db.supabase.storage
    .from(db.RECEIPTS_BUCKET)
    .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });
  if (uploadError) throw new Error(uploadError.message);
  if (existingPath) {
    await db.supabase.storage.from(db.RECEIPTS_BUCKET).remove([existingPath]);
  }
  return storagePath;
}

async function signedUrlFor(storagePath) {
  const { data, error } = await db.supabase.storage.from(db.RECEIPTS_BUCKET).createSignedUrl(storagePath, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function removeReceipt(storagePath) {
  await db.supabase.storage.from(db.RECEIPTS_BUCKET).remove([storagePath]);
}

module.exports = { upload, uploadReceipt, signedUrlFor, removeReceipt };
