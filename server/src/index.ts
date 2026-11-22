import express, { Request, Response, NextFunction } from 'express';
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

// Nginx / Cloudflare Tunnel 配下でクライアントIPを正しく認識させる
app.set('trust proxy', 1);

// セキュリティヘッダー強化 (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // SPA対応
}));

// 一般 API レート制限（15分間で300回）
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストの上限を超えました。しばらく時間をおいて再試行してください。' }
});

// 認証 API 向けの厳格なレート制限（ブルートフォース対策: 15分間で30回）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '認証試行回数の上限を超えました。しばらく時間をおいて再試行してください。' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// ミドルウェア
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// API ルーティング登録
app.use('/api/auth', authRouter);
app.use('/api/shops', shopsRouter);

// ヘルスチェック API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Cheers Backend API', timestamp: new Date().toISOString() });
});

// グローバルエラーハンドラ
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
});

// データベース初期化完了後にサーバーを起動
async function startServer() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`🍺 Cheers Express Backend API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize database. Server exiting.', error);
    process.exit(1);
  }
}

startServer();
