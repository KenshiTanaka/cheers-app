import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db';
import { authRouter } from './routes/auth';
import { shopsRouter } from './routes/shops';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア
app.use(cors());
app.use(express.json());

// データベース初期化＆シード投入
initDB();

// API ルーティング登録
app.use('/api/auth', authRouter);
app.use('/api/shops', shopsRouter);

// ヘルスチェック API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Cheers Backend API', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🍺 Cheers Express Backend API server running on port ${PORT}`);
});
