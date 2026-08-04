import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../data/database.sqlite');

console.log(`[Seed] Connecting to database at: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

const HOTPEPPER_API_KEY = '5c026a6238e0e4b8';

interface HotPepperShop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  station_name: string;
  genre: { name: string };
  budget: { name: string; average: string };
  photo: { pc: { l: string } };
  urls: { pc: string };
}

// プロミス化ヘルパー
const dbRun = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
};

// リアルな口コミテンプレート
const REVIEW_COMMENTS = [
  '歓送迎会で利用しました！コースのボリュームが満点で飲み放題の提供スピードも早かったです。',
  '落ち着いた雰囲気で個室があり、部署の懇親会にぴったりでした。焼酎や日本酒の品揃えも充実しています！',
  'コスパ最高です。刺身の盛り合わせが新鮮で美味しく、ビールもキンキンに冷えていました。',
  '駅近で集合・解散に便利でした！金曜の夜は混み合うので予約必須ですね。また使いたいです。',
  '個室の席が広くて居心地が良かったです。料理もお酒に合うおつまみが豊富でした。',
  'サワーやハイボールの種類が多くて若いメンバーにも大好評でした！唐揚げが絶品です。',
  '静かな完全個室で仕事の話もじっくりできました。接客も丁寧で満足です。',
  '飲み放題付きコースが安くてコスパ抜群！大衆酒場の賑やかな雰囲気で会話も弾みました。',
];

// ランダム数値生成
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ホットペッパーAPIからエリア別に居酒屋データを検索
async function fetchShopsForArea(keyword: string, count: number = 40): Promise<HotPepperShop[]> {
  console.log(`[HotPepper API] Fetching shops for keyword: "${keyword}" (count: ${count})...`);
  const url = `https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?key=${HOTPEPPER_API_KEY}&keyword=${encodeURIComponent(keyword)}&format=json&count=${count}`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API returned status ${res.status}`);
  }
  const data = await res.json();
  const shops = data?.results?.shop || [];
  console.log(`[HotPepper API] Fetched ${shops.length} shops for "${keyword}".`);
  return shops;
}

async function seedData() {
  try {
    console.log('=== 神田・大手町・有楽町 100件シード処理を開始します ===');

    // 1. 店舗データの取得 (各エリアから40件ずつ、計120件取得を目指す)
    const kandaShops = await fetchShopsForArea('神田 居酒屋', 40);
    const otemachiShops = await fetchShopsForArea('大手町 居酒屋', 40);
    const yurakuchoShops = await fetchShopsForArea('有楽町 居酒屋', 40);

    const allFetched = [...kandaShops, ...otemachiShops, ...yurakuchoShops];
    console.log(`合計 ${allFetched.length} 件のデータを受信しました。重複排除を開始します...`);

    // 重複排除（IDまたは店舗名ベース）
    const uniqueMap = new Map<string, HotPepperShop>();
    for (const shop of allFetched) {
      if (!uniqueMap.has(shop.id) && !uniqueMap.has(shop.name)) {
        uniqueMap.set(shop.id, shop);
      }
    }

    const uniqueShops = Array.from(uniqueMap.values());
    console.log(`重複排除後の店舗数: ${uniqueShops.length} 件`);

    // ユーザー一覧を取得（レビュー投稿者用）
    const users = await new Promise<any[]>((resolve, reject) => {
      db.all('SELECT id FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const userIds = users.map(u => u.id).length > 0 ? users.map(u => u.id) : [1];

    let insertedCount = 0;
    const roomTypes = ['あり', '半個室', 'なし'];

    for (const shop of uniqueShops) {
      // 既存店舗かチェック
      const existing = await dbGet('SELECT id FROM shops WHERE name = ? OR address = ?', [shop.name, shop.address]);
      if (existing) {
        continue;
      }

      // 駅名の推定（APIからの駅名、または住所から簡易補正）
      let station = shop.station_name || '';
      if (!station) {
        if (shop.address.includes('神田')) station = '神田駅';
        else if (shop.address.includes('大手町')) station = '大手町駅';
        else if (shop.address.includes('有楽町')) station = '有楽町駅';
        else station = '東京駅';
      }

      const category = shop.genre?.name || '大衆酒場';
      const lat = parseFloat(shop.lat as any) || 0;
      const lng = parseFloat(shop.lng as any) || 0;
      const walkMinutes = randomInt(1, 5);
      const japaneseStaffRatio = randomInt(70, 100);
      const privateRoomType = roomTypes[randomInt(0, roomTypes.length - 1)];
      const imageUrl = shop.photo?.pc?.l || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60';
      const createdBy = userIds[randomInt(0, userIds.length - 1)];

      // 1. 店舗をインサート
      const shopRes = await dbRun(`
        INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        shop.name,
        category,
        shop.address,
        lat,
        lng,
        station,
        walkMinutes,
        japaneseStaffRatio,
        privateRoomType,
        imageUrl,
        createdBy
      ]);

      const shopId = shopRes.lastID;

      // 2. 店舗ごとに1〜3件のダミー評価・口コミを自動生成してインサート
      const reviewCount = randomInt(1, 3);
      for (let i = 0; i < reviewCount; i++) {
        const reviewerId = userIds[randomInt(0, userIds.length - 1)];
        const tasteRating = randomInt(3, 5);
        const atmosphereRating = randomInt(3, 5);
        const drinkRating = randomInt(3, 5);
        const priceRating = randomInt(3, 5);
        const costPerPerson = randomInt(30, 60) * 100; // 3000円〜6000円
        const comment = REVIEW_COMMENTS[randomInt(0, REVIEW_COMMENTS.length - 1)];

        await dbRun(`
          INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          shopId,
          reviewerId,
          tasteRating,
          atmosphereRating,
          drinkRating,
          priceRating,
          costPerPerson,
          comment
        ]);
      }

      insertedCount++;
    }

    // 件数カウント
    const totalShops = await dbGet<{ count: number }>('SELECT count(*) as count FROM shops');
    console.log(`\n🎉 シード処理が正常に完了しました！`);
    console.log(`新規追加された店舗数: ${insertedCount} 件`);
    console.log(`データベース内の総店舗数: ${totalShops?.count} 件`);

    process.exit(0);
  } catch (error) {
    console.error('シード処理中にエラーが発生しました:', error);
    process.exit(1);
  }
}

seedData();
