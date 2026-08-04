import React, { useState } from 'react';
import { X, User as UserIcon, Building, MapPin, Beer, Utensils, Save } from 'lucide-react';
import { User } from '../types';

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ currentUser, onClose, onUpdate }) => {
  const [name, setName] = useState(currentUser.name || '');
  const [department, setDepartment] = useState(currentUser.department || '');
  const [favoriteArea, setFavoriteArea] = useState(currentUser.favorite_area || '');
  const [alcoholPreference, setAlcoholPreference] = useState(currentUser.alcohol_preference || '');
  const [favoriteFood, setFavoriteFood] = useState(currentUser.favorite_food || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentUser.id,
          name,
          department,
          favorite_area: favoriteArea,
          alcohol_preference: alcoholPreference,
          favorite_food: favoriteFood,
        })
      });

      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

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
        maxWidth: '520px',
        position: 'relative',
        padding: '28px'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={22} />
        </button>

        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserIcon size={22} color="#f59e0b" />
          マイプロフィール・好みの設定
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              氏名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              <Building size={14} color="#f59e0b" /> 所属部署 / 現場名
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="例: 大手町現場, 新宿営業部"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              <MapPin size={14} color="#f59e0b" /> よく使う駅（カンマ区切りで3つまで）
            </label>
            <input
              type="text"
              value={favoriteArea}
              onChange={(e) => setFavoriteArea(e.target.value)}
              placeholder="例: 神田駅, 大手町駅, 有楽町駅"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              <Beer size={14} color="#f59e0b" /> お酒の好み
            </label>
            <select
              value={alcoholPreference}
              onChange={(e) => setAlcoholPreference(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            >
              <option value="ビール・ハイボール派">🍺 ビール・ハイボール派</option>
              <option value="日本酒・焼酎党">🍶 日本酒・焼酎党</option>
              <option value="クラフトビール・ワイン">🍷 クラフトビール・ワイン派</option>
              <option value="サワー・カクテル派">🍹 サワー・カクテル派</option>
              <option value="お酒は弱め・ソフトドリンク">ソフトドリンクメイン</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              <Utensils size={14} color="#f59e0b" /> 好きな料理ジャンル
            </label>
            <input
              type="text"
              value={favoriteFood}
              onChange={(e) => setFavoriteFood(e.target.value)}
              placeholder="例: 焼き鳥, 刺身・海鮮, イタリアン"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary" style={{ marginTop: '10px' }}>
            <Save size={16} />
            <span>{saving ? '保存中...' : 'プロフィールを更新する'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
