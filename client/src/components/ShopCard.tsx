import React from 'react';
import { Star, MapPin, Users, DoorClosed, JapaneseYen, Utensils, GlassWater, Sparkles } from 'lucide-react';
import { Shop } from '../types';

interface ShopCardProps {
  shop: Shop;
  onClick: () => void;
}

export const ShopCard: React.FC<ShopCardProps> = ({ shop, onClick }) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative'
      }}
    >
      {/* 画像 ＆ バッジ */}
      <div style={{ position: 'relative', height: '180px', width: '100%', overflow: 'hidden' }}>
        <img
          src={shop.image_url || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60'}
          alt={shop.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
        />
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }}>
          {shop.category}
        </div>

        {/* 総合評価スコア */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#000',
          padding: '4px 10px',
          borderRadius: '20px',
          fontWeight: 800,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
        }}>
          <Star size={16} fill="#000" color="#000" />
          <span>{shop.overall_rating ? shop.overall_rating.toFixed(1) : '新規'}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({shop.review_count}件)</span>
        </div>
      </div>

      {/* カードコンテンツ */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '12px' }}>
        
        {/* タイトル */}
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1.3 }}>
          {shop.name}
        </h3>

        {/* アクセス・最寄り駅 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>
          <MapPin size={15} color="#f59e0b" />
          <span>{shop.station_name || '最寄り駅'} 徒歩{shop.walk_minutes}分</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span>{shop.address}</span>
        </div>

        {/* 4つの評価パラメータ（アイコン付きグリッド） */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '10px',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <Utensils size={13} color="#f59e0b" />
            <span style={{ color: '#94a3b8' }}>おいしさ:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{shop.avg_taste ? shop.avg_taste.toFixed(1) : '-'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <Sparkles size={13} color="#f59e0b" />
            <span style={{ color: '#94a3b8' }}>雰囲気:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{shop.avg_atmosphere ? shop.avg_atmosphere.toFixed(1) : '-'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <GlassWater size={13} color="#f59e0b" />
            <span style={{ color: '#94a3b8' }}>お酒の数:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{shop.avg_drink ? shop.avg_drink.toFixed(1) : '-'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            <JapaneseYen size={13} color="#f59e0b" />
            <span style={{ color: '#94a3b8' }}>コスパ:</span>
            <span style={{ fontWeight: 700, color: '#fbbf24' }}>{shop.avg_price ? shop.avg_price.toFixed(1) : '-'}</span>
          </div>
        </div>

        {/* 属性タグ (個室 / 日本人店員率 / 予算) */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge">
            <DoorClosed size={13} />
            個室: {shop.private_room_type}
          </span>

          <span className="badge badge-info">
            <Users size={13} />
            日本人店員: {shop.japanese_staff_ratio}%
          </span>

          <span style={{ marginLeft: 'auto', fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>
            約¥{shop.avg_cost ? Math.round(shop.avg_cost).toLocaleString() : '4,000'} /人
          </span>
        </div>

      </div>
    </div>
  );
};
