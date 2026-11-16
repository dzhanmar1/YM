import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Key, Cookie, Loader2, Clipboard, CheckCircle2, Sparkles, Smartphone } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useAuthStore } from '../store/authStore';
import { useIsMobile } from '../hooks/useIsMobile';

function extractOAuthToken(input: string): string {
  let cleaned = input.trim();
  if (cleaned.includes('access_token=')) {
    const match = cleaned.match(/access_token=([^&#\s]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return cleaned;
}

export function AuthModal() {
  const isMobile = useIsMobile();
  const [method, setMethod] = useState<'token' | 'cookies'>('token');
  const [value, setValue] = useState('');
  const [clipboardTokenDetected, setClipboardTokenDetected] = useState<string | null>(null);
  const [autoLogged, setAutoLogged] = useState(false);
  const { loginWithToken, loginWithCookies, isLoading, error } = useAuthStore();

  const handleOpenOAuthUrl = async () => {
    const oauthUrl =
      'https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d';
    try {
      await openUrl(oauthUrl);
    } catch {
      window.open(oauthUrl, '_blank');
    }
  };

  // Inspect clipboard for token helper
  const checkClipboard = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && (text.includes('access_token=') || text.startsWith('y0_AgAAAA'))) {
          const extracted = extractOAuthToken(text);
          if (extracted.length > 20) {
            setClipboardTokenDetected(extracted);
            setValue(extracted);
            return extracted;
          }
        }
      }
    } catch {
      // Clipboard permission denied or not available
    }
    return null;
  }, []);

  // When user returns to the app from the browser, auto-check clipboard
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkClipboard();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [checkClipboard]);

  const handleQuickPasteAndLogin = async () => {
    let token = clipboardTokenDetected;
    if (!token) {
      token = await checkClipboard();
    }
    if (token) {
      setAutoLogged(true);
      await loginWithToken(token).catch(() => setAutoLogged(false));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    if (method === 'token') {
      const cleanToken = extractOAuthToken(trimmed);
      setValue(cleanToken);
      await loginWithToken(cleanToken).catch(() => {});
    } else {
      await loginWithCookies(trimmed).catch(() => {});
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050505',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px' : '24px',
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          backgroundColor: '#0d0d0d',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: isMobile ? 20 : 16,
          padding: isMobile ? '28px 20px' : '36px 32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.95)',
          margin: 'auto',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 14,
              backgroundColor: '#ffffff',
              color: '#000000',
              fontWeight: 900,
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              letterSpacing: -0.5,
              boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
            }}
          >
            YM
          </div>
          <h1
            style={{
              fontSize: isMobile ? 21 : 22,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: -0.4,
              margin: 0,
            }}
          >
            Вход в Яндекс Музыку
          </h1>
          <p
            style={{
              fontSize: 12,
              color: '#888888',
              marginTop: 6,
              lineHeight: 1.4,
            }}
          >
            {isMobile
              ? 'Войдите в Яндекс ID для «Моей волны» и ваших плейлистов'
              : 'Авторизуйтесь для доступа к библиотеке и персональным рекомендациям'}
          </p>
        </div>

        {/* ONE-TAP OAUTH INVITATION BANNER (Especially useful on Android) */}
        <div
          style={{
            backgroundColor: '#141414',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            padding: '16px',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <Smartphone size={16} color="#ffffff" />
            <span>Быстрый вход на телефоне:</span>
          </div>

          <div
            style={{
              fontSize: 12,
              color: '#999999',
              lineHeight: 1.5,
              marginBottom: 14,
            }}
          >
            1. Нажмите кнопку входа и подтвердите доступ в браузере.<br />
            2. Скопируйте адрес страницы с токеном.<br />
            3. Вернитесь в YM — приложение подхватит его!
          </div>

          <button
            type="button"
            onClick={handleOpenOAuthUrl}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 10,
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(255, 255, 255, 0.15)',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <ExternalLink size={15} />
            <span>1. Открыть вход в Яндекс ID</span>
          </button>

          {/* Quick paste button */}
          <button
            type="button"
            onClick={handleQuickPasteAndLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '12px 0',
              borderRadius: 10,
              backgroundColor: clipboardTokenDetected ? '#1a3320' : '#1c1c1c',
              color: clipboardTokenDetected ? '#4ade80' : '#cccccc',
              border: `1px solid ${clipboardTokenDetected ? 'rgba(74, 222, 128, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {clipboardTokenDetected ? <CheckCircle2 size={15} /> : <Clipboard size={15} />}
            <span>
              {clipboardTokenDetected
                ? '2. Токен обнаружен! Нажмите, чтобы войти'
                : '2. Вставить скопированный токен / URL'}
            </span>
          </button>
        </div>

        {/* Method Toggle Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            backgroundColor: '#141414',
            borderRadius: 10,
            padding: 3,
            marginBottom: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => setMethod('token')}
            style={{
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              backgroundColor: method === 'token' ? '#222222' : 'transparent',
              color: method === 'token' ? '#ffffff' : '#777777',
              fontSize: 12,
              fontWeight: method === 'token' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Key size={13} />
            <span>Ввести токен</span>
          </button>

          <button
            type="button"
            onClick={() => setMethod('cookies')}
            style={{
              padding: '8px 0',
              borderRadius: 8,
              border: 'none',
              backgroundColor: method === 'cookies' ? '#222222' : 'transparent',
              color: method === 'cookies' ? '#ffffff' : '#777777',
              fontSize: 12,
              fontWeight: method === 'cookies' ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Cookie size={13} />
            <span>Cookies</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder={
                method === 'token'
                  ? 'y0_AgAAAA... (или вставьте всю строку)'
                  : 'Session_id=3:17...'
              }
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                if (method === 'token' && val.includes('access_token=')) {
                  setValue(extractOAuthToken(val));
                } else {
                  setValue(val);
                }
              }}
              style={{
                width: '100%',
                backgroundColor: '#121212',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 10,
                color: '#ffffff',
                padding: '12px 14px',
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#888888')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.14)')}
            />
          </div>

          {error && (
            <div
              style={{
                fontSize: 12,
                color: '#ff6666',
                marginBottom: 16,
                lineHeight: 1.4,
                wordBreak: 'break-word',
                backgroundColor: 'rgba(255, 80, 80, 0.1)',
                padding: '8px 12px',
                borderRadius: 8,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 10,
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              cursor: isLoading || !value.trim() ? 'default' : 'pointer',
              opacity: isLoading || !value.trim() ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            <span>{isLoading ? 'Авторизация...' : 'Войти в аккаунт'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
