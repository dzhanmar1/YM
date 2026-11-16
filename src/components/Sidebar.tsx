import { Radio, Heart, ListMusic, Search, Settings, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export type TabType = 'wave' | 'liked' | 'playlists' | 'search' | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export function Sidebar({ currentTab, onSelectTab }: SidebarProps) {
  const { status } = useAuthStore();

  const navItems: { id: TabType; label: string; icon: any }[] = [
    { id: 'wave', label: 'Моя волна', icon: Radio },
    { id: 'liked', label: 'Мне нравится', icon: Heart },
    { id: 'playlists', label: 'Коллекция', icon: ListMusic },
    { id: 'search', label: 'Поиск', icon: Search },
  ];

  return (
    <aside style={{
      width: 220,
      backgroundColor: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px 16px',
      flexShrink: 0,
      height: '100%',
    }}>
      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 10px 24px',
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          backgroundColor: 'var(--accent)',
          color: 'var(--accent-inverted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: -0.5,
        }}>
          YM
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.2 }}>
            YM Desktop
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            v0.1.0 • offline cache
          </div>
        </div>
      </div>

      {/* Navigation list */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-muted)',
          padding: '4px 10px',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
        }}>
          Медиатека
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.4 : 1.8} />
              <span>{item.label}</span>
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '25%',
                  bottom: '25%',
                  width: 3,
                  borderRadius: '0 2px 2px 0',
                  backgroundColor: 'var(--accent)',
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Account / Settings */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        <button
          onClick={() => onSelectTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: currentTab === 'settings' ? 'var(--bg-active)' : 'transparent',
            color: currentTab === 'settings' ? 'var(--text-primary)' : 'var(--text-secondary)',
            border: '1px solid',
            borderColor: currentTab === 'settings' ? 'var(--border-medium)' : 'transparent',
            cursor: 'pointer',
            fontSize: 13,
          }}
          onMouseEnter={(e) => {
            if (currentTab !== 'settings') e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
          }}
          onMouseLeave={(e) => {
            if (currentTab !== 'settings') e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Settings size={16} />
          <span>Настройки</span>
        </button>

        {status?.authenticated && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            marginTop: 4,
          }}>
            <div style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#1f1f1f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              <User size={13} />
            </div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                {status.name || status.login || 'Пользователь'}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
