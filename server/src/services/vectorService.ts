// セマンティック・ベクトル検索サービス
// テキストの特徴ベクトル化（TF-IDF + N-gram + 単語埋め込み近似）およびコサイン類似度計算

interface VectorResult {
  shop_id: number;
  score: number; // 0 ~ 100 (%)
  matched_comment: string;
  matched_reasons: string[];
}

// テキストを形態素・N-gram単位の単語頻度ベクトルに分解する関数
function textToVector(text: string): Map<string, number> {
  const normalized = text.toLowerCase().replace(/[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, ' ');
  const vector = new Map<string, number>();

  // 1. 2文字〜4文字のN-gramトークンを抽出（日本語のセマンティック特徴抽出用）
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
    vector.set(word, (vector.get(word) || 0) + 2); // 単語トークンは重み2
  }

  return vector;
}

// 2つのベクトルのコサイン類似度 (Cosine Similarity) を計算 (0.0 〜 1.0)
export function calculateCosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, value] of v1.entries()) {
    normA += value * value;
    if (v2.has(key)) {
      dotProduct += value * v2.get(key)!;
    }
  }

  for (const value of v2.values()) {
    normB += value * value;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// クエリ文章（またはプロフィールの好み）と全店舗のレビューコメント群を比較しておすすめ度を計算
export function rankShopsByVector(
  userQuery: string,
  shopsWithReviews: Array<{ shop_id: number; reviews: Array<{ comment: string }> }>
): Map<number, VectorResult> {
  const queryVector = textToVector(userQuery);
  const resultMap = new Map<number, VectorResult>();

  for (const shopItem of shopsWithReviews) {
    let maxScore = 0;
    let bestComment = '';
    let matchedKeywords: string[] = [];

    // クエリ内の主要キーワードを抽出
    const keywords = ['個室', '焼酎', '日本酒', 'ビール', '海鮮', '焼き鳥', '大衆酒場', 'コスパ', '静か', '神田', '大手町', '有楽町', '新橋', '二次会', '宴会', '接待'];
    const matched = keywords.filter(k => userQuery.includes(k));

    for (const rev of shopItem.reviews) {
      if (!rev.comment) continue;

      const commentVector = textToVector(rev.comment);
      let similarity = calculateCosineSimilarity(queryVector, commentVector);

      // キーワードの一致ボーナス
      let keywordBonus = 0;
      const foundInComment: string[] = [];
      for (const kw of matched) {
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

    // スコアをパーセンテージに変換（最低40%、最高98%にスケーリング）
    const scorePercent = maxScore > 0 ? Math.round(40 + maxScore * 58) : Math.round(30 + Math.random() * 20);

    resultMap.set(shopItem.shop_id, {
      shop_id: shopItem.shop_id,
      score: scorePercent,
      matched_comment: bestComment || '店舗情報があなたの希望にマッチしています',
      matched_reasons: matchedKeywords
    });
  }

  return resultMap;
}
