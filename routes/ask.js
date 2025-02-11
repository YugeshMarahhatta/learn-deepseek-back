// routes/ask.js
import express from 'express';
import fetch from 'node-fetch';
import { uploadedDocuments } from '../shared/uploadedDocuments.js';
import { OpenAI } from 'openai/index.mjs';
import dotenv from 'dotenv';
import path from 'path';
import { extractPdfText } from '../shared/PDFExtractor.js';

dotenv.config();

const router = express.Router();

// Initialize DeepSeek client (if needed elsewhere, otherwise you can remove it)
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
});

// POST /api/ask/:documentId
router.post('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

     // Determine file extension
    const fileExtension = path.extname(documentId).toLowerCase();
    let documentContent;

    if (fileExtension === '.txt') {
      documentContent = uploadedDocuments.get(documentId);
    } else if (fileExtension === '.pdf') {
      const filePath = path.resolve(process.cwd(), 'uploads', documentId);
      documentContent = await extractPdfText(filePath);
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file type' });
    }

    console.log("📜 Document Content:", documentContent ? "Loaded Successfully" : "Not Found");


    if (!documentContent) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Construct the prompt with clear instructions
    const prompt = `
    [INST] <<SYS>>
    You are a helpful assistant that answers questions based on the provided document.
    Only use information from the document to answer.
    If the answer isn't in the document, say "I don't know".
    <</SYS>>

    DOCUMENT CONTENT:
    ${documentContent}

    QUESTION: ${question} [/INST]
        `;

    // Call the external API (Ollama API in this example)
    try{
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "deepseek-r1",
          prompt: prompt,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json({ success: true, answer: data.response });
    }
    catch (error) {
      console.error('Error connectiong to DeepSeek Model.', error);
      res.status(500).json({ success: false, error: 'Failed to connect with deepseek model' });
    }
  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ success: false, error: 'Failed to process request' });
  }
});


export default router;

