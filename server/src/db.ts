import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const dataDir = process.env.DATABASE_PATH ? path.dirname(process.env.DATABASE_PATH) : path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.resolve(dataDir, 'database.sqlite');
console.log(`[DB] Using database file at: ${dbPath}`);

export const db = new sqlite3.Database(dbPath);

// ⚡ WALモード有効化 ＆ ビジータイムアウト (5秒) 設定で同時書き込み制限を回避
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA busy_timeout = 5000;');
  db.run('PRAGMA synchronous = NORMAL;');
});

// 指数バックオフ付きリトライヘルパー (SQLITE_BUSY 対策)
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 100): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.code === 'SQLITE_BUSY' || error?.message?.includes('locked'))) {
      console.warn(`[DB] Database locked, retrying in ${delay}ms... (remains: ${retries})`);
      await new Promise(res => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Promiseラッパー関数の定義（リトライ機能内蔵）
export const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return withRetry(() => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  });
};

export const dbGet = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return withRetry(() => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  });
};

export const dbAll = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  return withRetry(() => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  });
};

// テーブル初期化 ＆ 初期シード挿入
export async function initDB() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        department TEXT DEFAULT '',
        favorite_area TEXT DEFAULT '',
        alcohol_preference TEXT DEFAULT '',
        favorite_food TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS shops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL DEFAULT 0,
        lng REAL DEFAULT 0,
        station_name TEXT DEFAULT '',
        walk_minutes INTEGER DEFAULT 0,
        japanese_staff_ratio INTEGER DEFAULT 100,
        private_room_type TEXT DEFAULT 'なし',
        image_url TEXT DEFAULT '',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shop_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        taste_rating INTEGER CHECK(taste_rating BETWEEN 1 AND 5),
        atmosphere_rating INTEGER CHECK(atmosphere_rating BETWEEN 1 AND 5),
        drink_rating INTEGER CHECK(drink_rating BETWEEN 1 AND 5),
        price_rating INTEGER CHECK(price_rating BETWEEN 1 AND 5),
        cost_per_person INTEGER DEFAULT 4000,
        comment TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS authenticators (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up INTEGER DEFAULT 0,
        transports TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    try {
      await dbRun('ALTER TABLE users ADD COLUMN current_challenge TEXT');
    } catch (e) {
      // カラムが既に存在する場合は無視
    }

    const row = await dbGet<{ count: number }>('SELECT count(*) as count FROM users');
    if (!row || row.count === 0) {
      console.log('[DB] Seeding initial user and shop data...');
      const hashedPassword = bcrypt.hashSync('cheers123', 10);
      
      const resU1 = await dbRun(
        'INSERT INTO users (email, password, name, department, favorite_area, alcohol_preference, favorite_food) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['yamada@cheers.com', hashedPassword, '山田 太郎', '大手町現場', '大手町駅, 東京駅, 有楽町駅', 'ビール・ハイボール派', '居酒屋・焼き鳥']
      );

      const resU2 = await dbRun(
        'INSERT INTO users (email, password, name, department, favorite_area, alcohol_preference, favorite_food) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['sato@cheers.com', hashedPassword, '佐藤 美咲', '新宿現場', '新宿駅, 恵比寿駅, 渋谷駅', 'クラフトビール・ワイン', 'バル・イタリアン']
      );

      const resU3 = await dbRun(
        'INSERT INTO users (email, password, name, department, favorite_area, alcohol_preference, favorite_food) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['suzuki@cheers.com', hashedPassword, '鈴木 健太', '丸の内現場', '東京駅, 新橋駅, 品川駅', '日本酒・焼酎', '海鮮・和食']
      );

      const resS1 = await dbRun(
        'INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['Craft Beer Tavern 新橋本店', 'ビアバル・居酒屋', '東京都港区新橋2-16-1', 35.6664, 139.7583, '新橋駅', 2, 90, 'あり', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60', resU1.lastID]
      );

      const resS2 = await dbRun(
        'INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['個室和食 旬彩 恵比寿店', '個室和食・日本酒', '東京都渋谷区恵比寿1-10-8', 35.6467, 139.7101, '恵比寿駅', 4, 100, 'あり', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=60', resU2.lastID]
      );

      const resS3 = await dbRun(
        'INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['ネオ大衆酒場 チアーズ横丁 渋谷', '大衆酒場・焼き鳥', '東京都渋谷区道玄坂1-5-9', 35.6580, 139.6990, '渋谷駅', 3, 75, '半個室', 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&auto=format&fit=crop&q=60', resU3.lastID]
      );

      await dbRun(
        'INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [resS1.lastID, resU1.lastID, 5, 5, 5, 4, 4500, 'クラフトビールの種類が20種類以上あって最高！金曜の懇親会に超オススメです。個室もあります。']
      );

      await dbRun(
        'INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [resS1.lastID, resU2.lastID, 4, 5, 5, 3, 5000, 'おしゃれな雰囲気でビールが進みます！日本人店員さんも親切でした。']
      );

      await dbRun(
        'INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [resS2.lastID, resU2.lastID, 5, 4, 4, 4, 6000, '日本酒の品揃えが豊富。静かな個室で落ち着いて話せるので、役員同席の飲み会にも使えます。']
      );

      await dbRun(
        'INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [resS3.lastID, resU3.lastID, 4, 4, 4, 5, 3200, 'とにかくコスパが良い！飲み放題の種類が多くて若いメンバーの歓送迎会にぴったりでした。']
      );
    }
  } catch (error) {
    console.error('[DB] Initialization error:', error);
  }
}
