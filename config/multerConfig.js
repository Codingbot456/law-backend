const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the path to the uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Define storage for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set the destination for the uploaded files
    cb(null, uploadsDir); // Use the dynamically set uploads directory
  },
  filename: (req, file, cb) => {
    // Set the filename to include a timestamp
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // Append the current timestamp to the file name
  }
});

// Initialize multer with the storage configuration
const upload = multer({ storage });

module.exports = upload;
