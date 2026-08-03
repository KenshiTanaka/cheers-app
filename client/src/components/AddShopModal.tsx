import React, { useState } from 'react';
import { X, PlusCircle, MapPin, Search, Loader2, ChevronRight } from 'lucide-react';
import { User } from '../types';

interface AddShopModalProps {
  currentUser: User | null;
  onClose: () => void;
  onShopAdded: (newShopId?: number) => void;
}

interface ShopCandidate {
  name: string;
  address: string;
  lat: number;
  lng: number;
  station_name: string;
  walk_minutes: number;
  genre: string;
  budget: string;
  photo_url: string;
  hotpepper_url: string;
}

export const AddShopModal: React.FC<AddShopModalProps> = ({ currentUser, onClose, onShopAdded }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('大衆酒場');
  const [address, setAddress] = useState('');
  const [stationName, setStationName] = useState('');
  const [walkMinutes, setWalkMinutes] = useState<number | ''>('');
  const [japaneseStaffRatio, setJapaneseStaffRatio] = useState(90);
  const [privateRoomType, setPrivateRoomType] = useState<'あり' | 'なし' | '半個室'>('あり');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [addressNotice, setAddressNotice] = useState('');
  const [error, setError] = useState('');
  const [shopLat, setShopLat] = useState<number>(0);
  const [shopLng, setShopLng] = useState<number>(0);

  // 検索候補リスト
  const [candidates, setCandidates] = useState<ShopCandidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);

  // ホットペッパーAPIで店舗を検索
  const handleAutoSearchAddress = async () => {
    if (!name.trim()) {
      setError('店舗名を入力してから「住所を自動取得」を押してください。');
      return;
    }

    setSearchingAddress(true);
    setAddressNotice('');
    setError('');
    setCandidates([]);
    setShowCandidates(false);

    try {
      const res = await fetch(`/api/shops/search-place?name=${encodeURIComponent(name.trim())}`);

      if (res.status === 404) {
        setError(`「${name}」に該当する店舗がホットペッパーに見つかりませんでした。\n住所を手動で入力してください。`);
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error || '検索に失敗しました。');
        return;
      }

      const data = await res.json();
      const results: ShopCandidate[] = data.results || [];

      if (results.length === 0) {
        setError(`「${name}」に該当する店舗が見つかりませんでした。`);
        return;
      }

      if (results.length === 1) {
        // 1件のみの場合は自動セット
        selectCandidate(results[0]);
      } else {
        // 複数候補がある場合は選択UIを表示
        setCandidates(results);
        setShowCandidates(true);
      }
    } catch (e: any) {
      console.error('Search error:', e);
      setError('店舗検索で通信エラーが発生しました。');
    } finally {
      setSearchingAddress(false);
    }
  };

  // 候補を選択して各フィールドに自動セット
  const selectCandidate = (shop: ShopCandidate) => {
    setName(shop.name);
    setAddress(shop.address);
    setShopLat(shop.lat);
    setShopLng(shop.lng);
    setStationName(shop.station_name);
    setWalkMinutes(shop.walk_minutes || 3);
    if (shop.photo_url) setImageUrl(shop.photo_url);
    if (shop.genre) {
      // ジャンルのマッピング
      const genreMap: Record<string, string> = {
        '居酒屋': '大衆酒場',
        '焼鳥・串焼・鳥料理': '焼き鳥居酒屋',
        '海鮮料理': '海鮮居酒屋',
        '和食': '創作和食居酒屋',
        'ダイニングバー・バル': '洋風バル',
        '韓国料理': '韓国料理居酒屋',
        '鍋': '鍋料理専門店',
      };
      const matchedGenre = Object.entries(genreMap).find(([key]) => shop.genre.includes(key));
      if (matchedGenre) setCategory(matchedGenre[1]);
    }
    setCandidates([]);
    setShowCandidates(false);
    setAddressNotice(
      `✅ ホットペッパーから取得完了！\n店舗名: ${shop.name}\n住所: ${shop.address}\n最寄り駅: ${shop.station_name}\nジャンル: ${shop.genre}${shop.budget ? `\n予算: ${shop.budget}` : ''}`
    );
  };

  const [taste, setTaste] = useState(5);
  const [atmosphere, setAtmosphere] = useState(5);
  const [drink, setDrink] = useState(5);
  const [price, setPrice] = useState(4);
  const [cost, setCost] = useState(4500);
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) {
      setError('店舗名と住所を入力してください。');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // 1. 店舗登録
      const res = await fetch('/api/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          address,
          station_name: stationName,
          walk_minutes: walkMinutes || 3,
          lat: shopLat,
          lng: shopLng,
          japanese_staff_ratio: japaneseStaffRatio,
          private_room_type: privateRoomType,
          image_url: imageUrl || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&auto=format&fit=crop&q=60',
          user_id: currentUser?.id
        })
      });

      if (res.ok) {
        const createdShop = await res.json();
        
        // 2. 店舗登録成功後、同時に最初のレビューも自動投稿
        try {
          await fetch(`/api/shops/${createdShop.id}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser?.id || 1,
              taste_rating: taste,
              atmosphere_rating: atmosphere,
              drink_rating: drink,
              price_rating: price,
              cost_per_person: cost,
              comment: comment || '店舗を登録しました！'
            })
          });
        } catch (err) {
          console.error('Review submit error:', err);
        }

        onShopAdded(createdShop.id);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || '登録に失敗しました。');
      }
    } catch (e: any) {
      setError(e.message || '通信エラーが発生しました。');
    } finally {
      setSubmitting(false);
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
        maxWidth: '580px',
        position: 'relative',
        padding: '28px',
        maxHeight: '90vh',
        overflowY: 'auto'
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

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={22} color="#f59e0b" />
          新しい飲み会店舗を追加
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px', lineHeight: 1.5 }}>
          店舗名を入力して検索すると、ホットペッパーから住所・最寄り駅が自動セットされます
        </p>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
            {error}
          </div>
        )}

        {addressNotice && (
          <div style={{ background: 'rgba(52, 211, 153, 0.15)', border: '1px solid #10b981', color: '#6ee7b7', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {addressNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 店舗名 + 検索ボタン */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              店舗名 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAutoSearchAddress(); } }}
                placeholder="例: 芝浦ホルモン 田町店"
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              />
              <button
                type="button"
                disabled={searchingAddress}
                onClick={handleAutoSearchAddress}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '8px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {searchingAddress ? (
                  <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 検索中...</>
                ) : (
                  <><Search size={14} /> 検索</>
                )}
              </button>
            </div>
          </div>

          {/* ホットペッパー候補一覧 */}
          {showCandidates && candidates.length > 0 && (
            <div style={{
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid #f59e0b',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.15)', borderBottom: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <p style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: 700, margin: 0 }}>
                  🔍 {candidates.length}件の候補が見つかりました。選択してください：
                </p>
              </div>
              {candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectCandidate(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: i < candidates.length - 1 ? '1px solid rgba(71, 85, 105, 0.4)' : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                    color: '#f8fafc'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {c.photo_url ? (
                    <img src={c.photo_url} alt="" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem' }}>🍺</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {c.address}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                      🚉 {c.station_name} ・ {c.genre}{c.budget ? ` ・ ${c.budget}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={18} color="#475569" style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}

          {/* カテゴリ */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              ジャンル / カテゴリ
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            >
              <option value="大衆酒場">🍺 大衆酒場</option>
              <option value="焼き鳥居酒屋">🍢 焼き鳥居酒屋</option>
              <option value="海鮮居酒屋">🐟 海鮮居酒屋</option>
              <option value="おでん専門店">🍢 おでん専門店</option>
              <option value="創作和食居酒屋">🍣 創作和食居酒屋</option>
              <option value="家庭料理専門店">🍱 家庭料理専門店</option>
              <option value="立ち飲み居酒屋">🍻 立ち飲み居酒屋</option>
              <option value="鍋料理専門店">🍲 鍋料理専門店</option>
              <option value="洋風バル">🍷 洋風バル</option>
              <option value="韓国料理居酒屋">🇰🇷 韓国料理居酒屋</option>
            </select>
          </div>

          {/* 住所 */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              住所 <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '8px' }}>自動取得 or 手動入力</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="例: 東京都中央区銀座5-7-10"
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              />
              <MapPin size={18} color="#f59e0b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* 最寄り駅 ＆ 徒歩分数 */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                最寄り駅名
              </label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="自動セットされます"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                徒歩分数 (分)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={walkMinutes}
                onChange={(e) => setWalkMinutes(Number(e.target.value))}
                placeholder="自動"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              />
            </div>
          </div>

          {/* 個室・スタッフ率 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                個室の有無
              </label>
              <select
                value={privateRoomType}
                onChange={(e) => setPrivateRoomType(e.target.value as any)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              >
                <option value="あり">あり（完全個室）</option>
                <option value="半個室">半個室・仕切りあり</option>
                <option value="なし">なし（オープン席）</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                日本人スタッフ率 (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={japaneseStaffRatio}
                onChange={(e) => setJapaneseStaffRatio(Number(e.target.value))}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
              />
            </div>
          </div>

          {/* 画像URL */}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
              店舗写真 URL（任意・ホットペッパーから自動取得）
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="検索後に自動セットされます"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          {/* 初回評価 ＆ コメント入力 */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px',
            padding: '14px',
            marginTop: '8px'
          }}>
            <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: '10px' }}>
              ⭐ あなたの初評価・アドバイスコメント（同時登録）
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>おいしさ</label>
                <select value={taste} onChange={(e) => setTaste(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem' }}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>雰囲気</label>
                <select value={atmosphere} onChange={(e) => setAtmosphere(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem' }}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>お酒の数</label>
                <select value={drink} onChange={(e) => setDrink(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem' }}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>コスパ</label>
                <select value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.8rem' }}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>★ {n}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>社員への口コミ・おすすめアドバイス</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="個室の雰囲気、おすすめのメニュー、二回目も行きたいかなど..."
                style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #475569', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: '8px' }}>
            {submitting ? '店舗＆評価を投稿中...' : '店舗と評価を追加する'}
          </button>
        </form>
      </div>
    </div>
  );
};
