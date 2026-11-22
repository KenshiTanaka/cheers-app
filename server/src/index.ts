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
app.disable('x-powered-by');

// セキュリティヘッダー強化 (Helmet)
app.use(helmet({
  contentSecurityPolicy: false, // SPA配信はNginx側でCSPを付与
  crossOriginEmbedderPolicy: false,
}));

// CORS 制限（許可されたオリジンまたは同一オリジンリクエストのみ許可）
const customOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin: string): boolean => {
  if (customOrigins.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host.endsWith('.trycloudflare.com') && parsed.protocol === 'https:') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  } catch {
    return false;
  }
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    // 同一オリジン・サーバー間通信・ヘルスチェック (Originヘッダーなし) は許可
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/auth/passkey/login-options', authLimiter);
app.use('/api/auth/passkey/login-verify', authLimiter);

// リクエストボディサイズ制限
app.use(express.json({ limit: '256kb' }));

// API ルーティング登録
app.use('/api/auth', authRouter);
app.use('/api/shops', shopsRouter);

// ヘルスチェック API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'Cheers Backend API', timestamp: new Date().toISOString() });
});

// グローバルエラーハンドラ（CORS拒否や内部エラーの安全な返却）
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.startsWith('CORS policy:')) {
    return res.status(403).json({ error: '許可されていないオリジンからのリクエストです。' });
  }
  console.error('[Server] Unhandled error:', err);
  return res.status(500).json({ error: 'サーバー内部エラーが発生しました。' });
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
