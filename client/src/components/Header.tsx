import React from 'react';
import { Beer, PlusCircle, User as UserIcon, LogOut } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onOpenAuth: () => void;
  onOpenAddShop: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onOpenAuth, onOpenAddShop, onLogout }) => {
  return (
    <header className="glass-panel" style={{ margin: '16px auto 24px auto', borderRadius: '16px', padding: '14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* ロゴ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
          }}>
            <Beer size={26} color="#000000" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#f8fafc' }}>
              Cheers <span style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 600 }}>チアーズ</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>社内飲み会・店舗評価ナレッジ共有</p>
          </div>
        </div>

        {/* 右側アクション */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <>
              <button className="btn btn-primary" onClick={onOpenAddShop}>
                <PlusCircle size={18} />
                <span>店舗を追加する</span>
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: 'rgba(51, 65, 85, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <UserIcon size={16} color="#f59e0b" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</span>
                {user.department && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({user.department})</span>
                )}
                <button
                  onClick={onLogout}
                  title="ログアウト"
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: '4px', display: 'flex', alignItems: 'center' }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary" onClick={onOpenAuth}>
              <UserIcon size={18} />
              <span>ログイン / 新規登録</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
