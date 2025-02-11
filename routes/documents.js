// routes/documents.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /api/documents
router.get('/', (req, res) => {
  // Adjust the path since this file is in the "routes" folder
  const uploadsDir = path.join(__dirname, '../uploads');

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error('Error reading uploads folder:', err);
      return res.status(500).json({ success: false, error: 'Failed to read uploads folder' });
    }
    const documents = files
      .filter(file => !file.startsWith('.'))
      .map(file => ({ documentId: file }));
    res.json({ success: true, documents });
  });
});

export default router;
