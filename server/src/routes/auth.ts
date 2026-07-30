import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun } from '../db';

export const authRouter = Router();
const JWT_SECRET = 'cheers_secret_key_2026';

// 新規ユーザー登録 API
authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name, department, favorite_area, alcohol_preference, favorite_food } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'メールアドレス、パスワード、氏名は必須です。' });
    }

    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await dbRun(`
      INSERT INTO users (email, password, name, department, favorite_area, alcohol_preference, favorite_food)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [email, hashedPassword, name, department || '', favorite_area || '', alcohol_preference || '', favorite_food || '']);

    const userId = result.lastID;
    const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

    const user = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [userId]);

    return res.json({ token, user });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'ユーザー登録中にエラーが発生しました。' });
  }
});

// ログイン API
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください。' });
    }

    const user = await dbGet<any>('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userWithoutPassword } = user;
    return res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'ログイン中にエラーが発生しました。' });
  }
});

// プロフィール情報取得
authRouter.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: '認証が必要です。' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [decoded.id]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });
    return res.json(user);
  } catch (error) {
    return res.status(401).json({ error: '無効なトークンです。' });
  }
});
