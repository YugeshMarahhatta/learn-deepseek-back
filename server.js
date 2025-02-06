const express = require('express');
const { OpenAI } = require('openai');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process'); // Import exec from child_process
require('dotenv').config();
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

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

const upload = multer({ storage: storage });

// Initialize DeepSeek client
const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
});

// Store uploaded documents in memory
let uploadedDocuments = new Map();

// Upload document endpoint
app.post('/api/upload', upload.single('document'), async (req, res) => {
    console.log("Herer",req.file);
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const documentId = req.file.filename;
        
        uploadedDocuments.set(documentId, fileContent);

        res.json({
            success: true,
            documentId: documentId,
            message: 'Document uploaded successfully'
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload document'
        });
    }
});


// Ask questions about a specific document
app.post('/api/ask/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                error: 'Question is required'
            });
        }

        const documentContent = uploadedDocuments.get(documentId);
        if (!documentContent) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
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

        // Use Ollama's API directly instead of exec
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
        
        res.json({
            success: true,
            answer: data.response
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process request'
        });
    }
});


// Get list of uploaded documents
app.get('/api/documents', (req, res) => {
    const documents = Array.from(uploadedDocuments.keys()).map(id => ({
        documentId: id
    }));
    
    res.json({
        success: true,
        documents: documents
    });
});

app.listen(8020, () => {
    console.log('Server running on http://localhost:8020');
});