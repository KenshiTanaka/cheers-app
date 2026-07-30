import { Router } from 'express';
import { dbAll, dbGet, dbRun } from '../db';
import { findNearestStation } from '../services/stationService';
import { searchShopByName } from '../services/hotpepperService';

export const shopsRouter = Router();

// ホットペッパーAPIで店舗名から住所・最寄り駅を検索する API
shopsRouter.get('/search-place', async (req, res) => {
  try {
    const name = req.query.name as string;
    if (!name) {
      return res.status(400).json({ error: '店舗名を入力してください。' });
    }

    const shops = await searchShopByName(name);

    if (shops.length === 0) {
      return res.status(404).json({ error: '該当する店舗が見つかりませんでした。' });
    }

    // 候補リストを返す（フロントエンドで選択可能に）
    const results = shops.map(shop => {
      // ホットペッパーが最寄り駅名を返す。なければ座標から算出
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
    return res.status(500).json({ error: error.message || '店舗検索に失敗しました。' });
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
    return res.status(500).json({ error: error.message || '最寄り駅の算出に失敗しました。' });
  }
});

// 店舗一覧 ＆ 評価平均・検索取得
shopsRouter.get('/', async (req, res) => {
  try {
    const { category, private_room, station, sort, search } = req.query;

    let query = `
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
      WHERE 1=1
    `;

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
      query += ` AND (s.name LIKE ? OR s.address LIKE ? OR s.category LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` GROUP BY s.id`;

    if (sort === 'rating') {
      query += ` ORDER BY overall_rating DESC`;
    } else if (sort === 'reviews') {
      query += ` ORDER BY review_count DESC`;
    } else if (sort === 'price_asc') {
      query += ` ORDER BY avg_cost ASC`;
    } else {
      query += ` ORDER BY s.created_at DESC`;
    }

    const shops = await dbAll(query, params);
    return res.json(shops);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '店舗情報の取得中にエラーが発生しました。' });
  }
});

// 単一店舗詳細 ＆ レビュー一覧
shopsRouter.get('/:id', async (req, res) => {
  try {
    const shopId = req.params.id;
    const shop = await dbGet(`
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
      WHERE s.id = ?
      GROUP BY s.id
    `, [shopId]);

    if (!shop) {
      return res.status(404).json({ error: '店舗が見つかりません。' });
    }

    const reviews = await dbAll(`
      SELECT r.*, u.name as reviewer_name, u.department as reviewer_department, u.alcohol_preference as reviewer_alcohol
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.shop_id = ?
      ORDER BY r.created_at DESC
    `, [shopId]);

    return res.json({ ...shop, reviews });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '店舗詳細の取得中にエラーが発生しました。' });
  }
});

// 新規店舗登録 API（フロントから座標・最寄り駅情報を受け取る）
shopsRouter.post('/', async (req, res) => {
  try {
    const { name, category, address, station_name, walk_minutes, lat, lng, japanese_staff_ratio, private_room_type, image_url, user_id } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: '店舗名と住所は必須です。' });
    }

    // フロントから座標が送られてきた場合はそこから最寄り駅を再計算、なければフロントの値をそのまま使用
    let finalStationName = station_name || '';
    let finalWalkMinutes = walk_minutes !== undefined ? Number(walk_minutes) : 3;
    let finalLat = lat || 0;
    let finalLng = lng || 0;

    if (finalLat && finalLng && !station_name) {
      const stationResult = findNearestStation(finalLat, finalLng);
      finalStationName = stationResult.station_name;
      finalWalkMinutes = stationResult.walk_minutes;
    }

    const result = await dbRun(`
      INSERT INTO shops (name, category, address, lat, lng, station_name, walk_minutes, japanese_staff_ratio, private_room_type, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      category || '大衆酒場',
      address,
      finalLat,
      finalLng,
      finalStationName,
      finalWalkMinutes,
      japanese_staff_ratio !== undefined ? Number(japanese_staff_ratio) : 100,
      private_room_type || 'なし',
      image_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60',
      user_id || 1
    ]);

    const createdShop = await dbGet('SELECT * FROM shops WHERE id = ?', [result.lastID]);
    return res.json(createdShop);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || '店舗登録に失敗しました。' });
  }
});

// 評価レビュー投稿 API
shopsRouter.post('/:id/reviews', async (req, res) => {
  try {
    const shopId = req.params.id;
    const { user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment } = req.body;

    if (!taste_rating || !atmosphere_rating || !drink_rating || !price_rating) {
      return res.status(400).json({ error: 'すべての5段階評価項目を入力してください。' });
    }

    const result = await dbRun(`
      INSERT INTO reviews (shop_id, user_id, taste_rating, atmosphere_rating, drink_rating, price_rating, cost_per_person, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      shopId,
      user_id || 1,
      Number(taste_rating),
      Number(atmosphere_rating),
      Number(drink_rating),
      Number(price_rating),
      cost_per_person ? Number(cost_per_person) : 4000,
      comment || ''
    ]);

    const newReview = await dbGet('SELECT * FROM reviews WHERE id = ?', [result.lastID]);
    return res.json(newReview);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'レビュー投稿に失敗しました。' });
  }
});
