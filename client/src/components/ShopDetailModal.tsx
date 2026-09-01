import React, { useState, useEffect } from 'react';
import { X, Star, MapPin, Users, DoorClosed, JapaneseYen, Utensils, GlassWater, Sparkles, Send, MessageSquare } from 'lucide-react';
import { Shop, User } from '../types';

interface ShopDetailModalProps {
  shopId: number | null;
  currentUser: User | null;
  onClose: () => void;
  onReviewAdded: () => void;
}

export const ShopDetailModal: React.FC<ShopDetailModalProps> = ({ shopId, currentUser, onClose, onReviewAdded }) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(false);

  // レビュー投稿フォーム状態
  const [taste, setTaste] = useState(5);
  const [atmosphere, setAtmosphere] = useState(5);
  const [drink, setDrink] = useState(5);
  const [price, setPrice] = useState(4);
  const [cost, setCost] = useState(4500);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (shopId) {
      fetchShopDetail();
    }
  }, [shopId]);

  const fetchShopDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shops/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setShop(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId) return;

    const token = localStorage.getItem('cheers_token');
    if (!token) {
      alert('レビュー投稿にはログインが必要です。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shops/${shopId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          taste_rating: taste,
          atmosphere_rating: atmosphere,
          drink_rating: drink,
          price_rating: price,
          cost_per_person: cost,
          comment,
          is_anonymous: isAnonymous
        })
      });

      if (res.ok) {
        setComment('');
        fetchShopDetail();
        onReviewAdded();
      } else {
        const errData = await res.json();
        alert(errData.error || 'レビュー投稿に失敗しました。');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (!shopId) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div className="glass-panel modal-content animate-fade-in">
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(120, 53, 15, 0.8)',
            border: 'none',
            color: '#fff',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}
        >
          <X size={20} />
        </button>

        {loading || !shop ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
            読み込み中...
          </div>
        ) : (
          <div>
            {/* ヘッダー画像・タイトル */}
            <div style={{ position: 'relative', height: '240px', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <img
                src={shop.image_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60'}
                alt={shop.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(69, 26, 3, 0.95) 0%, transparent 60%)',
                display: 'flex',
                alignItems: 'flex-end',
                padding: '20px'
              }}>
                <div>
                  <span className="badge" style={{ marginBottom: '8px' }}>{shop.category}</span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>{shop.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#cbd5e1', marginTop: '4px' }}>
                    <MapPin size={16} color="#f59e0b" />
                    <span>{shop.address} （<strong>{shop.station_name}</strong> 徒歩{shop.walk_minutes}分）</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 属性・平均評価サマリー */}
            <div className="summary-grid">
              <div style={{ background: 'rgba(69, 26, 3, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={14} color="#f59e0b" /> おいしさ平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.review_count > 0 && shop.avg_taste ? shop.avg_taste.toFixed(1) : '-.-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(69, 26, 3, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#f59e0b" /> 雰囲気平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.review_count > 0 && shop.avg_atmosphere ? shop.avg_atmosphere.toFixed(1) : '-.-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(69, 26, 3, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GlassWater size={14} color="#f59e0b" /> お酒の数
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.review_count > 0 && shop.avg_drink ? shop.avg_drink.toFixed(1) : '-.-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(69, 26, 3, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <JapaneseYen size={14} color="#f59e0b" /> コスパ平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.review_count > 0 && shop.avg_price ? shop.avg_price.toFixed(1) : '-.-'} / 5.0
                </div>
              </div>
            </div>

            {/* 外部サービス連携 */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <a
                href={`https://tabelog.com/rstLst/?vs=1&sa=&sk=${encodeURIComponent(shop.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  background: 'rgba(234, 88, 12, 0.15)',
                  border: '1px solid rgba(234, 88, 12, 0.4)',
                  color: '#fb923c',
                  fontSize: '0.82rem',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                🔍 食べログで口コミを検索
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.name + ' ' + shop.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  color: '#60a5fa',
                  fontSize: '0.82rem',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                🗺️ Googleマップでルート確認
              </a>

              <a
                href={`https://www.hotpepper.jp/gstrtn/S001/net/search/?kw=${encodeURIComponent(shop.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '0.82rem',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                🍣 ホットペッパーで予約
              </a>
            </div>

            {/* 新規評価レビュー投稿フォーム */}
            {!currentUser ? (
              <div style={{
                background: 'rgba(69, 26, 3, 0.8)',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                marginBottom: '28px',
                textAlign: 'center'
              }}>
                <h4 style={{ color: '#fbbf24', marginBottom: '12px', fontSize: '1.1rem', fontWeight: 700 }}>
                  <Star size={18} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  評価・レビューを投稿する
                </h4>
                <p style={{ color: '#fde68a', fontSize: '0.9rem' }}>
                  ログインすると、このお店に5段階評価や口コミコメントを残すことができます。
                </p>
              </div>
            ) : (
            <form onSubmit={handleSubmitReview} style={{
              background: 'rgba(69, 26, 3, 0.8)',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              marginBottom: '28px'
            }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Star size={18} color="#f59e0b" fill="#f59e0b" />
                このお店を5段階で評価・投稿する
              </h4>

              <div className="rating-grid">
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>おいしさ (1~5)</label>
                  <select value={taste} onChange={(e) => setTaste(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e' }}>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>雰囲気 (1~5)</label>
                  <select value={atmosphere} onChange={(e) => setAtmosphere(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e' }}>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>お酒の数 (1~5)</label>
                  <select value={drink} onChange={(e) => setDrink(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e' }}>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>コスパ (1~5)</label>
                  <select value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e' }}>
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>使った予算 (円/人)</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  step="500"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>社内メンバーへのコメント・アドバイス</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="個室の雰囲気、おすすめのメニュー、二次会に向いているかなど..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#451a03', color: '#fff', border: '1px solid #92400e', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="anonymous-checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#f59e0b' }}
                />
                <label htmlFor="anonymous-checkbox" style={{ fontSize: '0.9rem', color: '#e2e8f0', cursor: 'pointer' }}>
                  匿名で投稿する（名前や部署を伏せる）
                </label>
              </div>

              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                <Send size={16} />
                <span>{submitting ? '投稿中...' : '評価レビューを投稿する'}</span>
              </button>
            </form>
            )}

            {/* 社員レビュー口コミ一覧 */}
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="#f59e0b" />
                社内メンバーの投稿レビュー ({shop.reviews?.length || 0}件)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {shop.reviews && shop.reviews.length > 0 ? (
                  shop.reviews.map((rev) => (
                    <div key={rev.id} style={{
                      background: 'rgba(120, 53, 15, 0.5)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <strong style={{ color: '#f59e0b' }}>{rev.reviewer_name}</strong>
                          {rev.reviewer_department && (
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '6px' }}>({rev.reviewer_department})</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(rev.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '8px' }}>
                        <span>味: ★{rev.taste_rating}</span>
                        <span>雰囲気: ★{rev.atmosphere_rating}</span>
                        <span>酒: ★{rev.drink_rating}</span>
                        <span>コスパ: ★{rev.price_rating}</span>
                        <span>予算: ¥{rev.cost_per_person.toLocaleString()}</span>
                      </div>

                      {rev.comment && (
                        <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {rev.comment}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>まだレビューがありません。最初のレビューを投稿してみましょう！</p>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
