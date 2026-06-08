const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Users",
    allowed_formats: ["jpeg", "jpg", "png", "gif", "avif", "webp", "pdf"],
    resource_type: "auto",
  },
});

const reportStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "MedicalReports",
    // Use raw to keep files exactly as uploaded (preserving PDFs, etc.)
    resource_type: "raw",
  },
});

const upload = multer({ storage: storage });
const reportUpload = multer({ storage: reportStorage });

// Attach reportUpload to the main upload middleware object for backwards compatibility
upload.reportUpload = reportUpload;

module.exports = upload;