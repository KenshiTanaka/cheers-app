import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ShopCard } from './components/ShopCard';
import { ShopDetailModal } from './components/ShopDetailModal';
import { AddShopModal } from './components/AddShopModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Shop, User } from './types';
import { Search, Filter, Sparkles, Award, MapPin, Beer, Trophy } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルター＆検索ステート
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [privateRoom, setPrivateRoom] = useState('すべて');
  const [sort, setSort] = useState('rating');

  // モーダルステート
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [showAddShop, setShowAddShop] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // 初期化（ログインチェック & トークン有効性検証）
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('cheers_token');
      const savedUser = localStorage.getItem('cheers_user');

      if (savedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            localStorage.setItem('cheers_user', JSON.stringify(userData));
          } else {
            // トークン期限切れ
            handleLogout();
          }
        } catch (e) {
          if (savedUser) setUser(JSON.parse(savedUser));
        }
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    fetchShops();
  }, [category, privateRoom, sort]);

  // AIベクトルおすすめ検索ステート
  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiTitle, setAiTitle] = useState('');

  const fetchShops = async () => {
    setLoading(true);
    setAiMode(false);
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (privateRoom !== 'すべて') params.append('private_room', privateRoom);
      if (sort) params.append('sort', sort);
      if (search) params.append('search', search);

      const res = await fetch(`/api/shops?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setShops(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // AIベクトル推薦の取得
  const fetchRecommendShops = async (customQuery?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const textToSearch = customQuery !== undefined ? customQuery : aiQuery;
      if (textToSearch) params.append('query', textToSearch);
      if (user?.id) params.append('user_id', String(user.id));

      const res = await fetch(`/api/shops/recommend?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setShops(data);
        setAiMode(true);
        if (customQuery !== undefined) setAiQuery(customQuery);
        setAiTitle(textToSearch ? `「${textToSearch}」のニュアンスに近いおすすめ` : 'あなたのお好みプロフィールに基づくおすすめ');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShops();
  };

  const handleAuthSuccess = (loggedUser: User, token: string) => {
    setUser(loggedUser);
    localStorage.setItem('cheers_token', token);
    localStorage.setItem('cheers_user', JSON.stringify(loggedUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cheers_token');
    localStorage.removeItem('cheers_user');
  };

  return (
    <div className="container">
      {/* ヘッダー */}
      <Header
        user={user}
        onOpenAuth={() => setShowAuth(true)}
        onOpenAddShop={() => setShowAddShop(true)}
        onLogout={handleLogout}
      />

      {/* ヒーローセクション (ビールテーマ & ナレッジインフォ) */}
      <div className="glass-panel hero-section">
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '680px' }}>
          <div className="badge" style={{ marginBottom: '12px' }}>
            <Sparkles size={14} /> 社内飲み会・懇親会特化型評価プラットフォーム
          </div>
          <h2 className="hero-title">
            今夜の飲み会を、<br />
            <span style={{ color: '#f59e0b', textShadow: '0 0 20px rgba(245, 158, 11, 0.3)' }}>最高の体験にする店舗ナレッジ。</span>
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '20px' }}>
            「おいしさ」「雰囲気」「お酒の数」「コスパ」を社員目線で5段階評価。<br />
            日本人スタッフ割合や個室情報、最寄り駅徒歩分数も自動算出して可視化します。
          </p>

          {user && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 14px',
              background: 'rgba(245, 158, 11, 0.12)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              fontSize: '0.85rem',
              flexWrap: 'wrap'
            }}>
              <Beer size={16} color="#f59e0b" />
              <span>
                ようこそ <strong>{user.name}</strong> さん！ (現場: <strong>{user.department || '未設定'}</strong>) - よく使う駅: <strong>{user.favorite_area || '神田, 大手町, 有楽町'}</strong>
              </span>
              <button
                onClick={() => setShowProfile(true)}
                style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ✏️ 好みを編集
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AIベクトルおすすめ診断・検索セクション */}
      <div className="glass-panel" style={{
        padding: '20px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="#34d399" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              AIベクトルおすすめ検索 （口コミのニュアンス解析）
            </h3>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => fetchRecommendShops()}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={15} />
              ⭐ マイプロフィールから自動おすすめ
            </button>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); fetchRecommendShops(); }} className="ai-search-form">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="例: 「神田で落ち着いた完全個室があって、焼酎が豊富なお店」「有楽町で安く飲める大衆酒場」など気分や条件を入力..."
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#0f172a',
              border: '1px solid #334155',
              color: '#fff',
              fontSize: '0.9rem'
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
              borderColor: '#10b981',
              whiteSpace: 'nowrap',
              fontSize: '0.88rem'
            }}
          >
            <Sparkles size={16} />
            AIでマッチ検索
          </button>
        </form>
      </div>

      {aiMode && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#6ee7b7',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <div>
            <strong>🎯 AIセマンティック検索結果:</strong> {aiTitle}
          </div>
          <button
            onClick={() => fetchShops()}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            通常の検索一覧に戻る
          </button>
        </div>
      )}

      {/* 検索・フィルター コントロール */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} className="search-form-grid">
          
          {/* 検索入力 */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="店舗名・エリア・料理で検索..."
              style={{
                width: '100%',
                padding: '10px 10px 10px 36px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          {/* カテゴリ */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
          >
            <option value="">すべてのジャンル</option>
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

          {/* 個室フィルター */}
          <select
            value={privateRoom}
            onChange={(e) => setPrivateRoom(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
          >
            <option value="すべて">個室: すべて</option>
            <option value="あり">完全個室あり</option>
            <option value="半個室">半個室あり</option>
            <option value="なし">個室なし</option>
          </select>

          {/* ソート順 */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            style={{ padding: '10px', borderRadius: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', fontSize: '0.85rem' }}
          >
            <option value="rating">★ 総合評価順</option>
            <option value="reviews">💬 レビュー件数順</option>
            <option value="price_asc">💰 予算が安い順</option>
            <option value="newest">🆕 新着順</option>
          </select>

          <button type="submit" className="btn btn-secondary">
            <span>検索</span>
          </button>
        </form>
      </div>

      {/* 店舗グリッド一覧 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          店舗データを読み込み中...
        </div>
      ) : shops.length > 0 ? (
        <div className="shop-grid">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onClick={() => setSelectedShopId(shop.id)}
            />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          該当する店舗が見つかりませんでした。
        </div>
      )}

      {/* モーダル群 */}
      {selectedShopId && (
        <ShopDetailModal
          shopId={selectedShopId}
          currentUser={user}
          onClose={() => setSelectedShopId(null)}
          onReviewAdded={fetchShops}
        />
      )}

      {showAddShop && (
        <AddShopModal
          currentUser={user}
          onClose={() => setShowAddShop(false)}
          onShopAdded={(newShopId) => {
            fetchShops();
            if (newShopId) {
              setSelectedShopId(newShopId);
            }
          }}
        />
      )}

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {showProfile && user && (
        <UserProfileModal
          currentUser={user}
          onClose={() => setShowProfile(false)}
          onUpdate={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('cheers_user', JSON.stringify(updatedUser));
          }}
        />
      )}
    </div>
  );
};
