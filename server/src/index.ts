import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initDB } from './db';
import { authRouter } from './routes/auth';
import { shopsRouter } from './routes/shops';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// セキュリティヘッダー強化 (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // SPA対応
}));

// DDoS・ブルートフォース攻撃対策（レート制限: 15分間で100回）
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストの上限を超えました。しばらく時間をおいて再試行してください。' }
});

app.use('/api/', limiter);

// ミドルウェア
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
