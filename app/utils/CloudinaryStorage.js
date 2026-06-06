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

const upload = multer({ storage: storage });

module.exports = upload;