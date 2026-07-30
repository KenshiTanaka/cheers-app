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
    if (!shopId || !currentUser) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/shops/${shopId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          taste_rating: taste,
          atmosphere_rating: atmosphere,
          drink_rating: drink,
          price_rating: price,
          cost_per_person: cost,
          comment
        })
      });

      if (res.ok) {
        setComment('');
        fetchShopDetail();
        onReviewAdded();
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
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        padding: '24px'
      }}>
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(51, 65, 85, 0.8)',
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
                background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, transparent 60%)',
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Utensils size={14} color="#f59e0b" /> おいしさ平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.avg_taste ? shop.avg_taste.toFixed(1) : '-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} color="#f59e0b" /> 雰囲気平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.avg_atmosphere ? shop.avg_atmosphere.toFixed(1) : '-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GlassWater size={14} color="#f59e0b" /> お酒の数
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.avg_drink ? shop.avg_drink.toFixed(1) : '-'} / 5.0
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <JapaneseYen size={14} color="#f59e0b" /> コスパ平均
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  ★ {shop.avg_price ? shop.avg_price.toFixed(1) : '-'} / 5.0
                </div>
              </div>
            </div>

            {/* 店舗属性タグ */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <div className="badge">
                <DoorClosed size={16} />
                個室状況: {shop.private_room_type}
              </div>
              <div className="badge badge-info">
                <Users size={16} />
                日本人スタッフ率: {shop.japanese_staff_ratio}%
              </div>
              <div className="badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.3)' }}>
                <JapaneseYen size={16} />
                想定予算: 約¥{Math.round(shop.avg_cost || 4000).toLocaleString()} / 人
              </div>
            </div>

            {/* 新規評価レビュー投稿フォーム */}
            {currentUser ? (
              <form onSubmit={handleSubmitReview} style={{
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--color-border)',
                marginBottom: '28px'
              }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Star size={18} color="#f59e0b" fill="#f59e0b" />
                  このお店を5段階で評価・投稿する
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>おいしさ (1~5)</label>
                    <select value={taste} onChange={(e) => setTaste(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569' }}>
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>雰囲気 (1~5)</label>
                    <select value={atmosphere} onChange={(e) => setAtmosphere(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569' }}>
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>お酒の数 (1~5)</label>
                    <select value={drink} onChange={(e) => setDrink(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569' }}>
                      {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>コスパ (1~5)</label>
                    <select value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569' }}>
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
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569' }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>社内メンバーへのコメント・アドバイス</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="個室の雰囲気、おすすめのメニュー、二次会に向いているかなど..."
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', resize: 'vertical' }}
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
                  <Send size={16} />
                  <span>{submitting ? '投稿中...' : '評価レビューを投稿する'}</span>
                </button>
              </form>
            ) : (
              <div style={{ background: 'rgba(51, 65, 85, 0.4)', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px' }}>
                評価の投稿にはログインが必要です。
              </div>
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
                      background: 'rgba(30, 41, 59, 0.5)',
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
