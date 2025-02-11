// routes/upload.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { uploadedDocuments } from '../shared/uploadedDocuments.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// POST /api/upload
router.post('/', upload.single('document'), async (req, res) => {
  console.log("Uploading file:", req.file);
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Read file content (assuming text files; for binary files you may need a different approach)
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const documentId = req.file.filename;

    // Save document content in shared state
    uploadedDocuments.set(documentId, fileContent);

    res.json({
      success: true,
      documentId: documentId,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

export default router;
