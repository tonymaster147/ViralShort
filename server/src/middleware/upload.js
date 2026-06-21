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
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB cap
    fileFilter: (req, file, cb) => {
      if (allowedMimePrefix && !file.mimetype.startsWith(allowedMimePrefix)) {
        return cb(new Error(`Only ${allowedMimePrefix}* files are allowed`));
      }
      cb(null, true);
    },
  });
}

// Mixed uploader for video + optional music (no mime restriction so audio passes).
function makeMixedUploader(subdir) {
  const dest = path.join(UPLOAD_ROOT, subdir);
  fs.mkdirSync(dest, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
    },
  });
  return multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });
}

const uploadAvatar = makeUploader('avatars', 'image/');
const uploadVideo = makeUploader('videos', 'video/');
// Accepts fields: video (required), music (optional), voiceover (optional)
const uploadVideoWithMusic = makeMixedUploader('videos').fields([
  { name: 'video', maxCount: 1 },
  { name: 'music', maxCount: 1 },
  { name: 'voiceover', maxCount: 1 },
]);

module.exports = { uploadAvatar, uploadVideo, uploadVideoWithMusic, UPLOAD_ROOT };
