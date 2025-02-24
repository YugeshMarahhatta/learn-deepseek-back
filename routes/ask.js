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

// Enhanced conversation history storage with timestamps
const conversationHistories = new Map();

// Helper function to manage conversation history with timestamps
const updateConversationHistory = (documentId, question, answer) => {
    const now = Date.now();
    
    if (!conversationHistories.has(documentId)) {
        conversationHistories.set(documentId, {
            messages: [],
            lastUpdated: now
        });
    }
    
    const history = conversationHistories.get(documentId);
    history.messages.push({ role: 'user', content: question, timestamp: now });
    history.messages.push({ role: 'assistant', content: answer, timestamp: now });
    history.lastUpdated = now;
    
    // Keep only the last 10 exchanges (20 messages)
    while (history.messages.length > 20) {
        history.messages.shift();
    }
    
    return history.messages;
};

// Function to format conversation history for the prompt
const formatConversationHistory = (history) => {
    return history.messages.map(msg => 
        `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
    ).join('\n');
};

// Function to clean up old conversations
const cleanupOldConversations = () => {
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [documentId, history] of conversationHistories.entries()) {
        if (now - history.lastUpdated > oneDayInMs) {
            conversationHistories.delete(documentId);
        }
    }
};

// Run cleanup every hour
setInterval(cleanupOldConversations, 60 * 60 * 1000);

// New route to manually clear conversation history
router.delete('/:documentId/history', (req, res) => {
    const { documentId } = req.params;
    
    if (conversationHistories.has(documentId)) {
        conversationHistories.delete(documentId);
        res.json({ success: true, message: 'Conversation history cleared' });
    } else {
        res.json({ success: true, message: 'No history found for this document' });
    }
});

// POST /api/ask/:documentId
router.post('/:documentId', async (req, res) => {
    try {
        const { documentId } = req.params;
        const { question, clearHistory } = req.body;

        // Check if user wants to clear history
        if (clearHistory) {
            conversationHistories.delete(documentId);
            return res.json({ success: true, message: 'Conversation history cleared' });
        }

        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }

        // Clean up old conversations before processing new request
        cleanupOldConversations();

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

        // Get conversation history
        const history = conversationHistories.get(documentId) || { messages: [] };
        const conversationContext = formatConversationHistory(history);

        // Construct the prompt with conversation history
        const prompt = `
        [INST] <<SYS>>
        You are a helpful assistant that answers questions ONLY using information from the provided document. Follow these rules:
        1. If the question cannot be answered using the document, respond with "I don't know"
        2. Keep your answers concise and directly relevant to the question
        3. Never mention that you're referring to a document
        4. Only reply the greetings of user
        5. Use the conversation history to maintain context and provide consistent responses
        6. I repeat don't give answer outside the document except greetings
        <</SYS>>

        Document Content:
        ${documentContent}

        Previous Conversation:
        ${conversationContext}

        Current Question: ${question} [/INST]
        `;

        try {
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
            
            // Update conversation history with the new exchange
            updateConversationHistory(documentId, question, data.response);

            res.json({ success: true, answer: data.response });
        } catch (error) {
            console.error('Error connecting to DeepSeek Model.', error);
            res.status(500).json({ success: false, error: 'Failed to connect with deepseek model' });
        }
    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
});

export default router;