import fs from 'fs';
import { PdfReader } from 'pdfreader';
import path from 'path';
import { fileURLToPath } from 'url';
// import * as pdfjs from 'pdfjs-dist';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.min.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const extractPdfText = async (filePath) => {
    if (!filePath) {
        console.error("❌ No file path provided");
        return "File doesn't exist";
    }

    try {
        const dataBuffer = await fs.promises.readFile(filePath);
        const pdf = await pdfjs.getDocument(new Uint8Array(dataBuffer)).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map(item => item.str).join(' ');
            fullText += text + '\n';
        }
        return fullText.trim();
    } catch (err) {
        console.error("❌ Error extracting PDF:", err);
        return "Error extracting PDF content";
    }
};