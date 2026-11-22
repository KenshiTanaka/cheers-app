export const DEFAULT_SHOP_IMAGE =
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60';

export const SHOP_CATEGORIES = [
  { value: '大衆酒場', label: '🍺 大衆酒場' },
  { value: '焼き鳥居酒屋', label: '🍢 焼き鳥居酒屋' },
  { value: '海鮮居酒屋', label: '🐟 海鮮居酒屋' },
  { value: 'おでん専門店', label: '🍢 おでん専門店' },
  { value: '創作和食居酒屋', label: '🍣 創作和食居酒屋' },
  { value: '家庭料理専門店', label: '🍱 家庭料理専門店' },
  { value: '立ち飲み居酒屋', label: '🍻 立ち飲み居酒屋' },
  { value: '鍋料理専門店', label: '🍲 鍋料理専門店' },
  { value: '洋風バル', label: '🍷 洋風バル' },
  { value: '韓国料理居酒屋', label: '🇰🇷 韓国料理居酒屋' },
] as const;

export const ALCOHOL_PREFERENCES = [
  { value: 'ビール・クラフトビール派', label: '🍺 ビール・クラフトビール派' },
  { value: 'ハイボール中心', label: '🥃 ハイボール中心' },
  { value: 'サワー・チューハイ派', label: '🍋 サワー・チューハイ派' },
  { value: '焼酎・泡盛派', label: '🍶 焼酎・泡盛派' },
  { value: '日本酒派', label: '🍶 日本酒派' },
  { value: 'ワイン・カクテル派', label: '🍷 ワイン・カクテル派' },
  { value: 'ノンアルコール・ソフトドリンク中心', label: '🥤 ノンアル中心' },
] as const;
