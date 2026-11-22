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
const envJwtSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && (!envJwtSecret || envJwtSecret.length < 16)) {
  throw new Error('[Auth] FATAL: JWT_SECRET must be set (at least 16 chars) in production!');
}
const JWT_SECRET = envJwtSecret || 'cheers_secret_key_2026_dev_only';
const RP_NAME = 'Cheers App';
const ALLOWED_DOMAIN = 'northsand.co.jp';
const MAX_ACTIVE_CHALLENGES = 1000;

const clampStr = (val: unknown, maxLen: number): string =>
  typeof val === 'string' ? val.trim().slice(0, maxLen) : '';

const getExpectedOrigins = (rpID: string) => [
  `https://${rpID}`,
  `http://${rpID}:3000`,
  `http://${rpID}`,
  'http://localhost:3000',
  'http://localhost'
];

// ログイン時の短期チャレンジ保持用メモリマップ (TTL: 5分)
const activeLoginChallenges = new Map<string, { challenge: string; expiresAt: number }>();

function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [key, val] of activeLoginChallenges.entries()) {
    if (val.expiresAt < now) {
      activeLoginChallenges.delete(key);
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string };
}

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

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedName = clampStr(name, 100);

    if (!trimmedName || normalizedEmail.length > 254) {
      return res.status(400).json({ error: '有効なメールアドレスと氏名を入力してください。' });
    }

    if (String(password).length < 6 || String(password).length > 128) {
      return res.status(400).json({ error: 'パスワードは6文字以上128文字以下で入力してください。' });
    }

    // メールドメイン制限: @northsand.co.jp のみ許可
    const emailDomain = normalizedEmail.split('@')[1];
    if (emailDomain !== ALLOWED_DOMAIN) {
      return res.status(403).json({ error: `アカウント登録は @${ALLOWED_DOMAIN} のメールアドレスのみ許可されています。` });
    }

    const existingUser = await dbGet('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
    if (existingUser) {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています。' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const result = await dbRun(`
      INSERT INTO users (email, password, name, department, favorite_area, alcohol_preference, favorite_food)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      normalizedEmail,
      hashedPassword,
      trimmedName,
      clampStr(department, 100),
      clampStr(favorite_area, 200),
      clampStr(alcohol_preference, 100),
      clampStr(favorite_food, 300)
    ]);

    const userId = result.lastID;
    const token = jwt.sign({ id: userId, email: normalizedEmail }, JWT_SECRET, { expiresIn: '7d' });

    const user = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [userId]);

    return res.json({ token, user });
  } catch (error: any) {
    console.error('[Auth] Signup error:', error);
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

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await dbGet<any>('SELECT * FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
    if (!user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
    }

    const isValid = await bcrypt.compare(String(password), user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, current_challenge: __, ...userWithoutPassword } = user;
    return res.json({ token, user: userWithoutPassword });
  } catch (error: any) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ error: 'ログイン中にエラーが発生しました。' });
  }
});

// プロフィール情報取得
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [req.user!.id]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'ユーザー情報の取得に失敗しました。' });
  }
});

// プロフィール情報更新 API
authRouter.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, department, favorite_area, alcohol_preference, favorite_food } = req.body;
    const userId = req.user!.id;
    const trimmedName = clampStr(name, 100);

    if (!trimmedName) {
      return res.status(400).json({ error: '氏名は必須です。' });
    }

    await dbRun(`
      UPDATE users 
      SET name = ?, department = ?, favorite_area = ?, alcohol_preference = ?, favorite_food = ?
      WHERE id = ?
    `, [
      trimmedName,
      clampStr(department, 100),
      clampStr(favorite_area, 200),
      clampStr(alcohol_preference, 100),
      clampStr(favorite_food, 300),
      userId
    ]);

    const updatedUser = await dbGet('SELECT id, email, name, department, favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [userId]);
    return res.json(updatedUser);
  } catch (error: any) {
    return res.status(500).json({ error: 'プロフィールの更新に失敗しました。' });
  }
});

// -------------------------------------------------------------
// パスキー (Passkey / WebAuthn) 登録オプション生成
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
// パスキー (Passkey / WebAuthn) 登録検証 & 保存
// -------------------------------------------------------------
authRouter.post('/passkey/register-verify', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { response } = req.body;
    if (!response) return res.status(400).json({ error: 'リクエスト情報が不足しています。' });

    const user = await dbGet('SELECT id, current_challenge FROM users WHERE id = ?', [userId]);
    if (!user || !user.current_challenge) return res.status(400).json({ error: '無効または有効期限切れのチャレンジです。' });

    const rpID = getRpId(req);
    const expectedOrigin = getExpectedOrigins(rpID);

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
    cleanExpiredChallenges();
    const { email } = req.body;
    let allowCredentials: any[] = [];
    let userId: number | null = null;

    if (email) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const user = await dbGet('SELECT id FROM users WHERE LOWER(email) = ?', [normalizedEmail]);
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

    // ユーザー指定ありの場合は DB に保持、Discoverable Credential 用にメモリマップにも保存
    if (userId) {
      await dbRun('UPDATE users SET current_challenge = ? WHERE id = ?', [options.challenge, userId]);
    }
    if (activeLoginChallenges.size >= MAX_ACTIVE_CHALLENGES) {
      const oldestKey = activeLoginChallenges.keys().next().value;
      if (oldestKey !== undefined) activeLoginChallenges.delete(oldestKey);
    }
    activeLoginChallenges.set(options.challenge, {
      challenge: options.challenge,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

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
    const { response, challenge } = req.body;
    if (!response || !response.id) return res.status(400).json({ error: '無効な認証データです。' });

    const passkey = await dbGet('SELECT * FROM authenticators WHERE id = ?', [response.id]);
    if (!passkey) return res.status(400).json({ error: '登録されていないパスキーです。' });

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [passkey.user_id]);
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません。' });

    // DB の current_challenge または アクティブな発行済みチャレンジ（有効期限内）から検証対象を復元
    let expectedChallenge = user.current_challenge;
    if (!expectedChallenge && challenge && activeLoginChallenges.has(challenge)) {
      const entry = activeLoginChallenges.get(challenge)!;
      if (entry.expiresAt > Date.now()) {
        expectedChallenge = entry.challenge;
      } else {
        activeLoginChallenges.delete(challenge);
      }
    }

    if (!expectedChallenge) {
      return res.status(400).json({ error: '認証チャレンジが見つからないか有効期限が切れています。再度お試しください。' });
    }

    const rpID = getRpId(req);
    const expectedOrigin = getExpectedOrigins(rpID);

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
      if (challenge) activeLoginChallenges.delete(challenge);
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
