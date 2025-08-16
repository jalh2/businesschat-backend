const multer = require('multer');
// Audio uploads now use in-memory storage; persistence to GridFS is handled in the controller

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Audio upload using in-memory storage (controller writes to GridFS)
const audioMemoryStorage = multer.memoryStorage();

const audioFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only audio uploads are allowed'));
  }
};

const uploadAudio = multer({
  storage: audioMemoryStorage,
  fileFilter: audioFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

module.exports = { upload, uploadAudio };
