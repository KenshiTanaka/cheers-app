import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbGet, dbRun, dbAll } from '../db';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

export const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cheers_secret_key_2026';
const RP_NAME = 'Cheers App';

// 拡張 Request インターフェース
export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string };
}

// 認証ミドルウェア
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です。ログインしてください。' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効または有効期限切れです。再ログインしてください。' });
  }
};

const getRpId = (req: Request) => {
  return process.env.RP_ID || req.hostname;
};

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
    return res.status(500).json({ error: 'ユーザー登録中にエラーが発生しました。' });
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

    const { password: _, current_challenge: __, ...userWithoutPassword } = user;
    return res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    return res.status(500).json({ error: 'ログイン中にエラーが発生しました。' });
  }
});

// プロフィール情報取得 (保護対象)
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました。' });
  }
});

// プロフィール情報更新 API (保護対象)
authRouter.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, department, favorite_area, alcohol_preference, favorite_food } = req.body;
    const userId = req.user!.id;

    await dbRun(`
      UPDATE users 
      SET name = ?, department = ?, favorite_area = ?, alcohol_preference = ?, favorite_food = ?
      WHERE id = ?
    `, [name || '', department || '', favorite_area || '', alcohol_preference || '', favorite_food || '', userId]);

    const updatedUser = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [userId]);
    return res.json(updatedUser);
  } catch (error: any) {
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました。' });
  }
});

// -------------------------------------------------------------
// パスキー (Passkey / WebAuthn) 登録オプション生成 (保護対象)
// -------------------------------------------------------------
authRouter.post('/passkey/register-options', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await dbGet('SELECT id, email, name FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });

    const userPasskeys = await dbAll('SELECT id, transports FROM authenticators WHERE user_id = ?', [userId]);
    const rpID = getRpId(req);

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userID: new Uint8Array(Buffer.from(String(user.id))),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(pk => ({
        id: pk.id,
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await dbRun('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, user.id]);

    return res.json(options);
  } catch (error: any) {
    console.error('Register options error:', error);
    return res.status(500).json({ error: 'パスキー登録オプション生成に失敗しました。' });
  }
});

// -------------------------------------------------------------
// パスキー (Passkey / WebAuthn) 登録検証 & 保存 (保護対象)
// -------------------------------------------------------------
authRouter.post('/passkey/register-verify', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: 'リクエスト情報が不足しています。' });

    const user = await dbGet('SELECT id, current_challenge FROM users WHERE id = ?', [userId]);
    if (!user || !user.current_challenge) return res.status(400).json({ error: '無効または有効期限切れのチャレンジです。' });

    const rpID = getRpId(req);
    const expectedOrigin = [
      `https://${rpID}`,
      `http://${rpID}:3000`,
      `http://${rpID}`,
      'http://localhost:3000',
      'http://localhost'
    ];

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.current_challenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = registrationInfo;

      const pubKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');

      await dbRun(`
        INSERT INTO authenticators (id, user_id, public_key, counter, device_type, backed_up, transports)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        credentialID,
        user.id,
        pubKeyBase64,
        counter,
        credentialDeviceType,
        credentialBackedUp ? 1 : 0,
        JSON.stringify(response.response?.transports || [])
      ]);

      await dbRun('UPDATE users SET current_challenge = NULL WHERE id = ?', [user.id]);
      return res.json({ verified: true });
    }

    return res.status(400).json({ error: 'パスキーの検証に失敗しました。' });
  } catch (error: any) {
    console.error('Register verify error:', error);
    return res.status(500).json({ error: 'パスキー登録検証中にエラーが発生しました。' });
  }
});

// -------------------------------------------------------------
// パスキー (Passkey / WebAuthn) ログインオプション生成
// -------------------------------------------------------------
authRouter.post('/passkey/login-options', async (req, res) => {
  try {
    const { email } = req.body;
    let allowCredentials: any[] = [];
    let userId: number | null = null;

    if (email) {
      const user = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
      if (user) {
        userId = user.id;
        const passkeys = await dbAll('SELECT id, transports FROM authenticators WHERE user_id = ?', [user.id]);
        allowCredentials = passkeys.map(pk => ({
          id: pk.id,
          transports: pk.transports ? JSON.parse(pk.transports) : undefined,
        }));
      }
    }

    const rpID = getRpId(req);
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    if (userId) {
      await dbRun('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, userId]);
    }

    return res.json({ options, challenge: options.challenge });
  } catch (error: any) {
    console.error('Login options error:', error);
    return res.status(500).json({ error: 'パスキー認証の初期化に失敗しました。' });
  }
});

// -------------------------------------------------------------
// パスキー (Passkey / WebAuthn) ログイン検証 & 自動ログイン
// -------------------------------------------------------------
authRouter.post('/passkey/login-verify', async (req, res) => {
  try {
    const { response } = req.body;
    if (!response || !response.id) return res.status(400).json({ error: '無効な認証データです。' });

    const passkey = await dbGet('SELECT * FROM authenticators WHERE id = ?', [response.id]);
    if (!passkey) return res.status(400).json({ error: '登録されていないパスキーです。' });

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [passkey.user_id]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });

    // 認証チャレンジはDB内の値のみを使用し、クライアントが改ざんしたチャレンジを拒否
    const expectedChallenge = user.current_challenge;
    if (!expectedChallenge) return res.status(400).json({ error: '認証チャレンジが見つからないか無効です。再度ログインをお試しください。' });

    const rpID = getRpId(req);
    const expectedOrigin = [
      `https://${rpID}`,
      `http://${rpID}:3000`,
      `http://${rpID}`,
      'http://localhost:3000',
      'http://localhost'
    ];

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: passkey.id,
        credentialPublicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64')),
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
      await dbRun('UPDATE authenticators SET counter = ? WHERE id = ?', [authenticationInfo.newCounter, passkey.id]);
      await dbRun('UPDATE users SET current_challenge = NULL WHERE id = ?', [user.id]);

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, current_challenge: __, ...userWithoutPassword } = user;

      return res.json({ token, user: userWithoutPassword });
    }

    return res.status(400).json({ error: 'パスキー認証に失敗しました。' });
  } catch (error: any) {
    console.error('Login verify error:', error);
    return res.status(500).json({ error: 'パスキーログイン検証中にエラーが発生しました。' });
  }
});
