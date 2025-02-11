// server.mjs
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Import routers
import uploadRouter from './routes/upload.js';
import askRouter from './routes/ask.js';
import documentsRouter from './routes/documents.js';

// Mount the routers
app.use('/api/upload', uploadRouter);
app.use('/api/ask', askRouter);
app.use('/api/documents', documentsRouter);

const PORT = process.env.PORT || 8020;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
