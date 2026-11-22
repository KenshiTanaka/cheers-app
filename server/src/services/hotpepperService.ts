// ホットペッパーグルメサーチAPI サービス
// https://webservice.recruit.co.jp/doc/hotpepper/reference.html

const HOTPEPPER_BASE_URL = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分キャッシュ
const MAX_CACHE_SIZE = 200;

export interface HotPepperShop {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  station_name: string;
  genre: string;
  budget: string;
  open: string;
  close: string;
  photo_url: string;
  url: string;
}

const searchCache = new Map<string, { data: HotPepperShop[]; expiresAt: number }>();

// 店舗名キーワードで検索
export async function searchShopByName(keyword: string): Promise<HotPepperShop[]> {
  const apiKey = process.env.HOTPEPPER_API_KEY;
  if (!apiKey) {
    throw new Error('HOTPEPPER_API_KEY が環境変数に設定されていません。');
  }

  const normalizedKey = keyword.trim().toLowerCase();
  const cached = searchCache.get(normalizedKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const params = new URLSearchParams({
    key: apiKey,
    keyword: keyword.trim(),
    format: 'json',
    count: '5',
  });

  const url = `${HOTPEPPER_BASE_URL}?${params.toString()}`;
  console.log(`[HotPepper] Searching: ${keyword}`);

  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[HotPepper] API error: ${res.status} ${text}`);
    throw new Error(`HotPepper API error: ${res.status}`);
  }

  const data = await res.json();
  const shops = data?.results?.shop;

  if (!shops || shops.length === 0) {
    console.log(`[HotPepper] No results found for: ${keyword}`);
    return [];
  }

  console.log(`[HotPepper] Found ${shops.length} results for: ${keyword}`);

  const mapped: HotPepperShop[] = shops.map((shop: any) => ({
    id: shop.id || '',
    name: shop.name || '',
    address: shop.address || '',
    lat: parseFloat(shop.lat) || 0,
    lng: parseFloat(shop.lng) || 0,
    station_name: shop.station_name || '',
    genre: shop.genre?.name || '',
    budget: shop.budget?.name || '',
    open: shop.open || '',
    close: shop.close || '',
    photo_url: shop.photo?.pc?.l || shop.photo?.mobile?.l || '',
    url: shop.urls?.pc || '',
  }));

  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(normalizedKey, { data: mapped, expiresAt: Date.now() + CACHE_TTL_MS });

  return mapped;
}
