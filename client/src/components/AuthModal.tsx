import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Building, MapPin, Beer, Utensils, Fingerprint } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { User } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: (user: User, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);

  // フォームデータ
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('大手町現場');
  const [station1, setStation1] = useState('大手町駅');
  const [station2, setStation2] = useState('東京駅');
  const [station3, setStation3] = useState('新宿駅');
  const [alcoholPreference, setAlcoholPreference] = useState('ビール・クラフトビール派');
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['大衆酒場', '焼き鳥居酒屋']);

  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  // 🔑 パスキー (Face ID / 指紋認証) ログイン処理
  const handlePasskeyLogin = async () => {
    setError('');
    setPasskeyLoading(true);

    try {
      // 1. 認証オプション・チャレンジを取得
      const optsRes = await fetch('/api/auth/passkey/login-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined }),
      });
      const optsData = await optsRes.json();

      if (!optsRes.ok) throw new Error(optsData.error || 'パスキー初期化に失敗しました');

      // 2. ブラウザ生体認証ダイアログ（Face ID / Touch ID / Windows Hello）を起動
      const asseResp = await startAuthentication(optsData.options);

      // 3. 署名検証＆ログイン完了
      const verifyRes = await fetch('/api/auth/passkey/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: asseResp, challenge: optsData.challenge }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || '生体認証に失敗しました');

      onAuthSuccess(verifyData.user, verifyData.token);
      onClose();
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        setError(err.message || 'パスキー認証に失敗しました。端末にパスキーが登録されているかご確認ください。');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const favoriteAreaCombined = [station1, station2, station3].filter(Boolean).join(', ');
    const favoriteFoodCombined = selectedGenres.join(', ');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin
      ? { email, password }
      : { email, password, name, department, favorite_area: favoriteAreaCombined, alcohol_preference: alcoholPreference, favorite_food: favoriteFoodCombined };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        setError(data.error || '処理に失敗しました。');
      }
    } catch (e: any) {
      setError(e.message || '通信エラーが発生しました。');
    } finally {
      setLoading(false);
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

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
          {isLogin ? '🍺 チアーズにログイン' : '🍻 社員アカウント新規登録'}
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '20px' }}>
          {isLogin ? '社内メンバーのアカウントでログインします' : 'プロフィールを登録しておすすめ店舗情報を受け取りましょう'}
        </p>

        {/* 🔑 パスキー (Passkey) ワンタップ認証ボタン */}
        {isLogin && (
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              onClick={handlePasskeyLogin}
              disabled={passkeyLoading}
              className="btn"
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.3) 100%)',
                border: '1px solid #f59e0b',
                color: '#fbbf24',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
                cursor: 'pointer'
              }}
            >
              <Fingerprint size={22} color="#fbbf24" />
              <span>{passkeyLoading ? '生体認証を起動中...' : '🔑 パスキー (Face ID / 指紋認証) でログイン'}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0 6px 0', color: '#64748b', fontSize: '0.75rem' }}>
              <div style={{ flex: 1, borderBottom: '1px solid #334155' }} />
              <span style={{ padding: '0 10px' }}>またはパスワードでログイン</span>
              <div style={{ flex: 1, borderBottom: '1px solid #334155' }} />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* メールアドレス */}
          <div>
            <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="yamada@cheers.com"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          {/* パスワード */}
          <div>
            <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
            />
          </div>

          {/* 新規登録時追加項目 */}
          {!isLogin && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>氏名</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                />
              </div>

              {/* 所属現場 */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>所属現場</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="例: 大手町現場, 新宿現場"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                />
              </div>

              {/* よく使用する駅 (3つ) */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>よく使用する駅（3つ登録）</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    required
                    value={station1}
                    onChange={(e) => setStation1(e.target.value)}
                    placeholder="駅1 (例: 大手町駅)"
                    style={{ padding: '9px 8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.82rem', width: '100%' }}
                  />
                  <input
                    type="text"
                    value={station2}
                    onChange={(e) => setStation2(e.target.value)}
                    placeholder="駅2 (例: 東京駅)"
                    style={{ padding: '9px 8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.82rem', width: '100%' }}
                  />
                  <input
                    type="text"
                    value={station3}
                    onChange={(e) => setStation3(e.target.value)}
                    placeholder="駅3 (例: 新宿駅)"
                    style={{ padding: '9px 8px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff', fontSize: '0.82rem', width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>お酒の好み</label>
                <select value={alcoholPreference} onChange={(e) => setAlcoholPreference(e.target.value)} style={{ width: '100%', padding: '9px', borderRadius: '8px', background: '#1e293b', border: '1px solid #475569', color: '#fff' }}>
                  <option value="ビール・クラフトビール派">🍺 ビール・クラフトビール派</option>
                  <option value="サワー・チューハイ派">🍋 サワー・チューハイ派</option>
                  <option value="ハイボール中心">🥃 ハイボール中心</option>
                  <option value="焼酎・泡盛派">🍶 焼酎・泡盛派</option>
                  <option value="日本酒派">🍶 日本酒派</option>
                  <option value="ワイン・カクテル派">🍷 ワイン・カクテル派</option>
                  <option value="ノンアルコール・ソフトドリンク中心">🥤 ノンアル中心</option>
                </select>
              </div>

              {/* 好きなジャンル (チェックボックス複数選択) */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
                  好きな料理ジャンル（複数選択可）
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: '8px',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  background: '#1e293b',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #475569'
                }}>
                  {[
                    '大衆酒場',
                    '焼き鳥居酒屋',
                    '海鮮居酒屋',
                    'おでん専門店',
                    '創作和食居酒屋',
                    '家庭料理専門店',
                    '立ち飲み居酒屋',
                    '鍋料理専門店',
                    '洋風バル',
                    '韓国料理居酒屋'
                  ].map((genre) => (
                    <label key={genre} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      background: selectedGenres.includes(genre) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(51, 65, 85, 0.4)',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: selectedGenres.includes(genre) ? '1px solid #f59e0b' : '1px solid transparent',
                      transition: 'all 0.15s ease'
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(genre)}
                        onChange={() => toggleGenre(genre)}
                        style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
                      />
                      <span>{genre}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '10px' }}>
            {loading ? '処理中...' : isLogin ? 'ログイン' : 'アカウントを作成'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? '新規アカウント登録はこちら' : '既にアカウントをお持ちの方はこちら'}
          </button>
        </div>
      </div>
    </div>
  );
};
