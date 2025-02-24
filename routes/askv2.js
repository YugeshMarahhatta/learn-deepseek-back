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


//Alternate stream API
// routes/ask.js
router.post('/:documentId', async (req, res) => {
    try {
                const { documentId } = req.params;
        const { question, clearHistory } = req.body;


        console.log("object", documentId);
        // Validate input
        if (!documentId || !question) {
            return res.status(400).json({documentId});
        }

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // Get document content
        const documentContent = await getDocumentContent(documentId);
        const history = conversationHistories.get(documentId) || { messages: [] };

        // Build the prompt with thinking instructions
        const prompt = `
        [INST] <<SYS>>
        You are a helpful assistant. Show your thinking process wrapped in <think></think> tags
        before providing the final answer. Follow these rules:
        1. First analyze the document content
        2. Consider previous conversations
        3. Formulate your answer step-by-step
        4. Always wrap thinking in <think></think>
        5. Provide final answer after the thinking block
        <</SYS>>

        Document Content: ${documentContent}
        Question: ${question} [/INST]
        `;

        // Connect to Ollama streaming API
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "deepseek-r1",
                prompt: prompt,
                stream: true
            })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
        }

        // Stream processor
        const reader = await ollamaResponse.body.getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const parsed = JSON.parse(chunk);
            
            // Send SSE events
            res.write(`event: chunk\ndata: ${JSON.stringify(parsed)}\n\n`);
        }

        res.write('event: end\ndata: {}\n\n');
        res.end();

    } catch (error) {
        console.error('Stream error:', error);
        res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});


// Helper function to build prompt
async function buildPrompt(documentId, question) {
    const documentContent = await getDocumentContent(documentId);
    const history = conversationHistories.get(documentId) || { messages: [] };

    return `
    [INST] <<SYS>>
    You are a helpful assistant that answers questions ONLY using information from the provided document. 
    Include your thinking process wrapped in <think></think> tags before the final answer.
    <</SYS>>

    Document Content:
    ${documentContent}

    Previous Conversation:
    ${formatConversationHistory(history)}

    Current Question: ${question} [/INST]
    `;
}

// Document Content extractor function
async function getDocumentContent(documentId) {
    const fileExtension = path.extname(documentId).toLowerCase();
    
    if (fileExtension === '.txt') {
        // Retrieve from memory storage
        return uploadedDocuments.get(documentId) || '';
    } else if (fileExtension === '.pdf') {
        // Handle PDF files
        const filePath = path.resolve(
            process.cwd(), 
            'uploads', 
            documentId
        );
        
        try {
            return await extractPdfText(filePath);
        } catch (error) {
            console.error(`PDF extraction failed for ${documentId}:`, error);
            return '';
        }
    }
    return '';
}



export default router;