const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Build a multer instance that stores into uploads/<subdir> with a unique name.
function makeUploader(subdir, allowedMimePrefix) {
  const dest = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB cap
    fileFilter: (req, file, cb) => {
      if (allowedMimePrefix && !file.mimetype.startsWith(allowedMimePrefix)) {
        return cb(new Error(`Only ${allowedMimePrefix}* files are allowed`));
      }
      cb(null, true);
    },
  });
}

const uploadAvatar = makeUploader('avatars', 'image/');
const uploadVideo = makeUploader('videos', 'video/');

module.exports = { uploadAvatar, uploadVideo, UPLOAD_ROOT };
