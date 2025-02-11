import fs from 'fs';
import { PdfReader } from 'pdfreader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const extractPdfText = async (filePath) => {
  // If no file path is provided, return an error message.
  if (!filePath) {
    console.error("❌ File doesn't exist: No file path provided.");
    return "File doesn't exist";
  }

  console.log("Filepath:", filePath);

  // Check if the file exists and is not empty using fs.promises.stat.
  try {
    const stats = await fs.promises.stat(filePath);
    console.log(`File size: ${stats.size} bytes`);
    if (stats.size === 0) {
      console.error("❌ The file is empty.");
      return "The file is empty";
    }
  } catch (err) {
    console.error("❌ Error accessing file:", err);
    return "File doesn't exist";
  }

  // If the file exists and is not empty, process it with PdfReader.
  return new Promise((resolve, reject) => {
    let textContent = "";
    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) {
        console.error("Error during PDF parsing:", err);
        return reject(err);
      } else if (!item) {
        // End of file reached; print final accumulated text and resolve.
        console.log("Final PDF text:", textContent);
        return resolve(textContent);
      } else if (item.text) {
        textContent += item.text + " ";
      }
    });
  });
};

