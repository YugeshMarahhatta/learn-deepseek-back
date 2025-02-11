import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map to store document contents
export const uploadedDocuments = new Map();

// Function to load documents
const loadDocuments = () => {
  const uploadDir = path.resolve(process.cwd(), 'uploads'); // Ensures correct path

  if (!fs.existsSync(uploadDir)) {
    console.warn('⚠️ Uploads folder does not exist:', uploadDir);
    return;
  }

  fs.readdirSync(uploadDir).forEach((file) => {
    const filePath = path.join(uploadDir, file);

    if (fs.lstatSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath, 'utf-8');
      uploadedDocuments.set(file, content); // Store full filename as the key
    }
  });

//   console.log('✅ Documents loaded on startup:', [...uploadedDocuments.keys()]);
};

// Load documents when the server starts
loadDocuments();
