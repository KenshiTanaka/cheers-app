import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db';
import { findNearestStation } from '../services/stationService';
import { searchShopByName } from '../services/hotpepperService';
import { rankShopsByVector } from '../services/vectorService';
import { authMiddleware, AuthenticatedRequest } from './auth';

export const shopsRouter = Router();

// 全店舗APIに認証ミドルウェアを適用（社内限定データの保護）
shopsRouter.use(authMiddleware);

const SHOP_WITH_STATS_SELECT = `
  SELECT 
    s.*,
    u.name as creator_name,
    COALESCE(AVG(r.taste_rating), 0) as avg_taste,
    COALESCE(AVG(r.atmosphere_rating), 0) as avg_atmosphere,
    COALESCE(AVG(r.drink_rating), 0) as avg_drink,
    COALESCE(AVG(r.price_rating), 0) as avg_price,
    COALESCE(AVG((r.taste_rating + r.atmosphere_rating + r.drink_rating + r.price_rating) / 4.0), 0) as overall_rating,
    COUNT(r.id) as review_count,
    COALESCE(AVG(r.cost_per_person), 4000) as avg_cost
  FROM shops s
  LEFT JOIN users u ON s.created_by = u.id
  LEFT JOIN reviews r ON s.id = r.shop_id
`;

const DEFAULT_SHOP_IMAGE = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60';
const ALLOWED_PRIVATE_ROOMS = new Set(['あり', '半個室', 'なし']);

function isValidRating(val: unknown): boolean {
  const num = Number(val);
  return Number.isInteger(num) && num >= 1 && num <= 5;
}

function sanitizeImageUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) return DEFAULT_SHOP_IMAGE;
  const trimmed = url.trim();
  if (trimmed.length > 2048) return DEFAULT_SHOP_IMAGE;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // 無効なURLはデフォルト画像にフォールバック
  }
  return DEFAULT_SHOP_IMAGE;
}

function clampText(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

// セマンティック・ベクトル検索レコメンド API
shopsRouter.get('/recommend', async (req: AuthenticatedRequest, res) => {
  try {
    const query = clampText(req.query.query, 200);
    let targetText = query;

    // セキュリティ対策: クエリパラメータではなく認証済みトークンのユーザーIDを使用
    const userId = req.user!.id;
    const user = await dbGet('SELECT favorite_area, alcohol_preference, favorite_food FROM users WHERE id = ?', [userId]);
    if (user && !targetText.trim()) {
      targetText = `${user.favorite_area || ''} ${user.alcohol_preference || ''} ${user.favorite_food || ''}`;
    } else if (user) {
      targetText += ` ${user.favorite_area || ''} ${user.alcohol_preference || ''} ${user.favorite_food || ''}`;
    }

    if (!targetText.trim()) {
      targetText = '個室 居酒屋 ビール 日本酒 焼酎 美味しい コスパ';
    }

    const [shops, allReviews] = await Promise.all([
      dbAll(`${SHOP_WITH_STATS_SELECT} GROUP BY s.id`),
      dbAll('SELECT shop_id, comment FROM reviews')
    ]);

    const reviewsByShop = new Map<number, Array<{ comment: string }>>();
    for (const rev of allReviews) {
      const list = reviewsByShop.get(rev.shop_id);
      if (list) {
        list.push({ comment: rev.comment });
      } else {
        reviewsByShop.set(rev.shop_id, [{ comment: rev.comment }]);
      }
    }

    const shopsWithReviews = shops.map(s => ({
      shop_id: s.id,
      metadataText: `${s.name} ${s.category} ${s.station_name} ${s.address} ${s.private_room_type === 'あり' ? '個室' : s.private_room_type === '半個室' ? '半個室' : ''}`,
      reviews: reviewsByShop.get(s.id) || []
    }));

    const rankMap = rankShopsByVector(targetText, shopsWithReviews);

    const rankedShops = shops.map(shop => {
      const vecResult = rankMap.get(shop.id) || {
        score: 35,
        matched_comment: '',
        matched_reasons: []
      };
      return {
        ...shop,
        vector_score: vecResult.score,
        matched_comment: vecResult.matched_comment,
        matched_reasons: vecResult.matched_reasons
      };
    }).sort((a, b) => b.vector_score - a.vector_score || b.overall_rating - a.overall_rating);

    return res.json(rankedShops.slice(0, 30));
  } catch (error: any) {
    console.error('[recommend API error]:', error);
    return res.status(500).json({ error: 'おすすめ店舗の算出に失敗しました。' });
  }
});

// ホットペッパーAPIで店舗名から住所・最寄り駅を検索する API
shopsRouter.get('/search-place', async (req, res) => {
  try {
    const name = clampText(req.query.name, 100);
    if (!name) {
      return res.status(400).json({ error: '店舗名を入力してください。' });
    }

    const shops = await searchShopByName(name);

    if (shops.length === 0) {
      return res.status(404).json({ error: '該当する店舗が見つかりませんでした。' });
    }

    const results = shops.map(shop => {
      let stationName = shop.station_name;
      let walkMinutes = 3;

      if (!stationName && shop.lat && shop.lng) {
        const stationResult = findNearestStation(shop.lat, shop.lng);
        stationName = stationResult.station_name;
        walkMinutes = stationResult.walk_minutes;
      }

      return {
        name: shop.name,
        address: shop.address,
        lat: shop.lat,
        lng: shop.lng,
        station_name: stationName,
        walk_minutes: walkMinutes,
        genre: shop.genre,
        budget: shop.budget,
        photo_url: shop.photo_url,
        hotpepper_url: shop.url,
      };
    });

    return res.json({ results });
  } catch (error: any) {
    console.error('[search-place] Error:', error);
    return res.status(500).json({ error: '店舗検索に失敗しました。' });
  }
});

// 座標から最寄り駅を算出する API
shopsRouter.get('/nearest-station', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: '緯度（lat）と経度（lng）を指定してください。' });
    }

    const result = findNearestStation(lat, lng);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: '最寄り駅の算出に失敗しました。' });
  }
});

// 店舗一覧 ＆ 評価平均・検索取得
shopsRouter.get('/', async (req, res) => {
  try {
    const { category, private_room, station, sort, search } = req.query;

    let query = `${SHOP_WITH_STATS_SELECT} WHERE 1=1`;
    const params: any[] = [];

    if (category) {
      query += ` AND s.category LIKE ?`;
      params.push(`%${category}%`);
    }

    if (private_room && private_room !== 'すべて') {
      query += ` AND s.private_room_type = ?`;
      params.push(private_room);
    }

    if (station) {
      query += ` AND s.station_name LIKE ?`;
      params.push(`%${station}%`);
    }

    if (search) {
      query += ` AND (s.name LIKE ? OR s.address LIKE ? OR s.category LIKE ? OR s.station_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY s.id`;

    if (sort === 'rating') {
      query += ` ORDER BY overall_rating DESC, review_count DESC`;
    } else if (sort === 'reviews') {
      query += ` ORDER BY review_count DESC, overall_rating DESC`;
    } else if (sort === 'price_asc') {
      query += ` ORDER BY avg_cost ASC`;
    } else {
      query += ` ORDER BY s.created_at DESC`;
    }

    const shops = await dbAll(query, params);
    return res.json(shops);
  } catch (error: any) {
    console.error('[GET /shops] Error:', error);
    return res.status(500).json({ error: '店舗情報の取得中にエラーが発生しました。' });
  }
});

// 単一店舗詳細 ＆ レビュー一覧
shopsRouter.get('/:id', async (req, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!Number.isInteger(shopId) || shopId <= 0) {
      return res.status(400).json({ error: '無効な店舗IDです。' });
    }

    const [shop, reviews] = await Promise.all([
      dbGet(`${SHOP_WITH_STATS_SELECT} WHERE s.id = ? GROUP BY s.id`, [shopId]),
      dbAll(`
        SELECT r.*, 
               CASE WHEN r.is_anonymous = 1 THEN '匿名さん' ELSE COALESCE(u.name, '社内メンバー') END as reviewer_name, 
               CASE WHEN r.is_anonymous = 1 THEN '' ELSE u.department END as reviewer_department, 
               CASE WHEN r.is_anonymous = 1 THEN '' ELSE u.alcohol_preference END as reviewer_alcohol
        FROM reviews r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.shop_id = ?
        ORDER BY r.created_at DESC
      `, [shopId])
    ]);

    if (!shop) {
      return res.status(404).json({ error: '店舗が見つかりません。' });
    }

    return res.json({ ...shop, reviews });
  } catch (error: any) {
    console.error('[GET /shops/:id] Error:', error);
    return res.status(500).json({ error: '店舗詳細の取得中にエラーが発生しました。' });
  }
});

// 新規店舗登録 API (重複防止チェック付き)
shopsRouter.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { name, category, address, station_name, walk_minutes, lat, lng, japanese_staff_ratio, private_room_type, image_url } = req.body;
    const userId = req.user!.id;

    if (!name || !address || !String(name).trim() || !String(address).trim()) {
      return res.status(400).json({ error: '店舗名と住所は必須です。' });
    }

    const trimmedName = clampText(name, 120);
    const trimmedAddress = clampText(address, 250);
    const safeCategory = clampText(category, 60) || '大衆酒場';
    const safePrivateRoom = typeof private_room_type === 'string' && ALLOWED_PRIVATE_ROOMS.has(private_room_type)
      ? private_room_type
      : 'なし';
    const safeImageUrl = sanitizeImageUrl(image_url);

    // 🔍 既存の同名店舗または同一住所の店舗がないかチェック
    const existingShop = await dbGet<any>('SELECT id, name, address FROM shops WHERE name = ? OR address = ?', [trimmedName, trimmedAddress]);
    if (existingShop) {
      return res.status(409).json({
        error: `店舗「${existingShop.name}」は既に登録されています。既存の店舗ページからレビューを追加してください。`,
        existingShopId: existingShop.id
      });
    }

    let finalStationName = clampText(station_name, 60);
    let finalWalkMinutes = walk_minutes !== undefined && walk_minutes !== '' ? Math.min(120, Math.max(1, Number(walk_minutes))) : 3;
    const finalLat = Number(lat) || 0;
    const finalLng = Number(lng) || 0;

    if (finalLat && finalLng && !finalStationName) {
      const stationResult = findNearestStation(finalLat, finalLng);
      finalStationName = stationResult.station_name;
      finalWalkMinutes = stationResult.walk_minutes;
    }

    const staffRatio = japanese_staff_ratio !== undefined
      ? Math.min(100, Math.max(0, Number(japanese_staff_ratio)))
      : 100;

    const result = await dbRun(`
      INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      trimmedName,
      safeCategory,
      trimmedAddress,
      finalLat,
      finalLng,
      finalStationName,
      finalWalkMinutes,
      staffRatio,
      safePrivateRoom,
      safeImageUrl,
      userId
    ]);

    const createdShop = await dbGet('SELECT * FROM shops WHERE id = ?', [result.lastID]);
    return res.status(201).json(createdShop);
  } catch (error: any) {
    console.error('[POST /shops] Error:', error);
    return res.status(500).json({ error: '店舗登録に失敗しました。' });
  }
});

// 評価レビュー投稿 API
shopsRouter.post('/:id/reviews', async (req: AuthenticatedRequest, res) => {
  try {
    const shopId = Number(req.params.id);
    if (!Number.isInteger(shopId) || shopId <= 0) {
      return res.status(400).json({ error: '無効な店舗IDです。' });
    }

    const shopExists = await dbGet('SELECT id FROM shops WHERE id = ?', [shopId]);
    if (!shopExists) {
      return res.status(404).json({ error: '対象の店舗が見つかりません。' });
    }

    const userId = req.user!.id;
    const { taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment, is_anonymous } = req.body;

    if (!isValidRating(taste_rating) || !isValidRating(atmosphere_rating) || !isValidRating(drink_rating) || !isValidRating(price_rating)) {
      return res.status(400).json({ error: 'すべての評価項目を1〜5の整数で入力してください。' });
    }

    const cost = cost_per_person ? Math.min(1000000, Math.max(0, Number(cost_per_person))) : 4000;
    const safeComment = clampText(comment, 2000);

    const result = await dbRun(`
      INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment, is_anonymous)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shopId,
      userId,
      Number(taste_rating),
      Number(atmosphere_rating),
      Number(drink_rating),
      Number(price_rating),
      cost,
      safeComment,
      is_anonymous ? 1 : 0
    ]);

    const newReview = await dbGet('SELECT * FROM reviews WHERE id = ?', [result.lastID]);
    return res.status(201).json(newReview);
  } catch (error: any) {
    console.error('[POST /shops/:id/reviews] Error:', error);
    return res.status(500).json({ error: 'レビュー投稿に失敗しました。' });
  }
});
