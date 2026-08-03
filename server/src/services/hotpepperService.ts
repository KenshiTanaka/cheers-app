// ホットペッパーグルメサーチAPI サービス
// https://webservice.recruit.co.jp/doc/hotpepper/reference.html

const HOTPEPPER_API_KEY = '5c026a6238e0e4b8';
const HOTPEPPER_BASE_URL = 'https://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

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

// 店舗名キーワードで検索
export async function searchShopByName(keyword: string): Promise<HotPepperShop[]> {
  const params = new URLSearchParams({
    key: HOTPEPPER_API_KEY,
    keyword: keyword,
    format: 'json',
    count: '5',
  });

  const url = `${HOTPEPPER_BASE_URL}?${params.toString()}`;
  console.log(`[HotPepper] Searching: ${keyword}`);

  const res = await fetch(url);

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

  return shops.map((shop: any) => ({
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
}
