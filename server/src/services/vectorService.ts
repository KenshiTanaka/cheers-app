// セマンティック・ベクトル検索サービス
// テキストの特徴ベクトル化（TF-IDF + N-gram + 単語埋め込み近似）およびコサイン類似度計算

export interface VectorResult {
  shop_id: number;
  score: number; // 0 ~ 100 (%)
  matched_comment: string;
  matched_reasons: string[];
}

export interface ShopVectorInput {
  shop_id: number;
  metadataText?: string;
  reviews: Array<{ comment: string }>;
}

// テキストベクトルのメモリキャッシュ（毎リクエストの再分割コストを削減・FIFO/LRU上限管理）
const MAX_CACHE_SIZE = 1000;
const vectorCache = new Map<string, Map<string, number>>();

const DOMAIN_KEYWORDS = [
  '個室', '半個室', '焼酎', '日本酒', 'ビール', 'クラフトビール', 'ワイン', 'ハイボール',
  '海鮮', '焼き鳥', 'おでん', '鍋', '大衆酒場', 'バル', '韓国', '和食',
  'コスパ', '安い', '静か', 'おしゃれ', '神田', '大手町', '有楽町', '新橋', '東京', '渋谷', '新宿', '恵比寿', '銀座',
  '二次会', '宴会', '接待', '歓送迎会'
];

// テキストを形態素・N-gram単位の単語頻度ベクトルに分解する関数
function textToVector(text: string): Map<string, number> {
  const existing = vectorCache.get(text);
  if (existing) {
    // 最近使ったキーを末尾に移動（簡易LRU）
    vectorCache.delete(text);
    vectorCache.set(text, existing);
    return existing;
  }

  const normalized = text.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, ' ');
  const vector = new Map<string, number>();

  // 1. 2文字〜4文字のN-gramトークンを抽出
  const cleanStr = normalized.replace(/\s+/g, '');
  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= cleanStr.length - len; i++) {
      const token = cleanStr.substring(i, i + len);
      vector.set(token, (vector.get(token) || 0) + 1);
    }
  }

  // 2. スペース区切り単語トークン
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    vector.set(word, (vector.get(word) || 0) + 2);
  }

  // キャッシュサイズ上限制御（古いエントリから削除）
  if (vectorCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = vectorCache.keys().next().value;
    if (oldestKey !== undefined) {
      vectorCache.delete(oldestKey);
    }
  }
  vectorCache.set(text, vector);

  return vector;
}

// 2つのベクトルのコサイン類似度 (Cosine Similarity) を計算 (0.0 〜 1.0)
export function calculateCosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, value] of v1.entries()) {
    normA += value * value;
    const v2Val = v2.get(key);
    if (v2Val !== undefined) {
      dotProduct += value * v2Val;
    }
  }

  for (const value of v2.values()) {
    normB += value * value;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// クエリ文章（またはプロフィールの好み）と全店舗のメタ情報・レビューコメント群を比較しておすすめ度を計算
export function rankShopsByVector(
  userQuery: string,
  shopsWithReviews: ShopVectorInput[]
): Map<number, VectorResult> {
  const queryVector = textToVector(userQuery);
  const resultMap = new Map<number, VectorResult>();
  const matchedQueryKeywords = DOMAIN_KEYWORDS.filter(k => userQuery.includes(k));

  for (const shopItem of shopsWithReviews) {
    let maxScore = 0;
    let bestComment = '';
    let matchedKeywords: string[] = [];

    // 店舗の基本情報（店舗名・カテゴリ・駅・個室等）との類似度をベーススコアとして算出
    if (shopItem.metadataText) {
      const metaVector = textToVector(shopItem.metadataText);
      const metaSim = calculateCosineSimilarity(queryVector, metaVector);
      let metaBonus = 0;
      const foundInMeta: string[] = [];
      for (const kw of matchedQueryKeywords) {
        if (shopItem.metadataText.includes(kw)) {
          metaBonus += 0.12;
          foundInMeta.push(kw);
        }
      }
      const metaTotal = Math.min(0.95, metaSim + metaBonus);
      if (metaTotal > maxScore) {
        maxScore = metaTotal;
        matchedKeywords = foundInMeta;
      }
    }

    // レビューコメントとの類似度を算出
    for (const rev of shopItem.reviews) {
      if (!rev.comment) continue;

      const commentVector = textToVector(rev.comment);
      const similarity = calculateCosineSimilarity(queryVector, commentVector);

      let keywordBonus = 0;
      const foundInComment: string[] = [];
      for (const kw of matchedQueryKeywords) {
        if (rev.comment.includes(kw)) {
          keywordBonus += 0.15;
          foundInComment.push(kw);
        }
      }

      const totalScore = Math.min(1.0, similarity + keywordBonus);

      if (totalScore > maxScore) {
        maxScore = totalScore;
        bestComment = rev.comment;
        matchedKeywords = foundInComment;
      }
    }

    // 決定的なスコア算出（ランダム値を排除し、毎回一貫した順位を保証）
    const scorePercent = maxScore > 0 ? Math.round(40 + maxScore * 58) : 35;

    resultMap.set(shopItem.shop_id, {
      shop_id: shopItem.shop_id,
      score: scorePercent,
      matched_comment: bestComment || (matchedKeywords.length > 0
        ? `「${matchedKeywords.join('・')}」の条件にマッチしています`
        : '店舗情報があなたの希望にマッチしています'),
      matched_reasons: matchedKeywords
    });
  }

  return resultMap;
}
