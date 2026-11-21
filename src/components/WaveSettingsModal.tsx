import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Heart, Sparkles, Zap, Radio, Check, Flame, Smile, Coffee, CloudRain, Loader2 } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { usePlayerStore } from '../store/playerStore';

const ACTIVITIES = [
  { id: 'work-background', label: 'Работа', icon: '💼' },
  { id: 'workout', label: 'Спорт', icon: '⚡' },
  { id: 'driving', label: 'В дороге', icon: '🚗' },
  { id: 'wake-up', label: 'Утро', icon: '🌅' },
  { id: 'fall-asleep', label: 'Сон', icon: '🌙' },
];

const LANGUAGES = [
  { id: 'russian', label: 'Русский' },
  { id: 'not-russian', label: 'Иностранный' },
  { id: 'without-words', label: 'Без слов' },
];

const CHARACTERS = [
  { id: 'favorite', label: 'Любимое', desc: 'Знакомые и частые треки', icon: Heart },
  { id: 'discover', label: 'Незнакомое', desc: 'Новые открытия и находки', icon: Sparkles },
  { id: 'popular', label: 'Популярное', desc: 'Хиты и тренды', icon: Flame },
];

const MOODS = [
  { id: 'active', label: 'Бодрое', icon: Zap, color: '#ff6b35' },
  { id: 'fun', label: 'Радостное', icon: Smile, color: '#e63946' },
  { id: 'calm', label: 'Спокойное', icon: Coffee, color: '#00b4d8' },
  { id: 'sad', label: 'Грустное', icon: CloudRain, color: '#7209b7' },
];

export const WaveSettingsModal: React.FC = () => {
  const { waveSettingsOpen, setWaveSettingsOpen } = useWindowStore();
  const { waveMode, startWave, startCustomWave } = usePlayerStore();

  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!waveSettingsOpen) return;

    const { waveSettings } = usePlayerStore.getState();
    if (waveSettings) {
      setSelectedActivity(waveSettings.activity || null);
      setSelectedMood(waveSettings.mood || null);
      setSelectedCharacter(waveSettings.character || null);
      let lang = waveSettings.language || null;
      if (lang === 'english') lang = 'not-russian';
      if (lang === 'instrumental') lang = 'without-words';
      setSelectedLanguage(lang);
    } else {
      setSelectedActivity(null);
      setSelectedCharacter(null);
      setSelectedMood(null);
      setSelectedLanguage(null);
    }
  }, [waveSettingsOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && waveSettingsOpen) {
        setWaveSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [waveSettingsOpen, setWaveSettingsOpen]);

  const handleResetToDefault = async () => {
    setSelectedActivity(null);
    setSelectedCharacter(null);
    setSelectedMood(null);
    setSelectedLanguage(null);
    setLoading(true);
    try {
      await startWave();
      setWaveSettingsOpen(false);
    } catch (err) {
      console.error('Failed to reset wave:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      if (selectedActivity || selectedMood || selectedCharacter || selectedLanguage) {
        await startCustomWave({
          activity: selectedActivity || undefined,
          mood: selectedMood || undefined,
          character: selectedCharacter || undefined,
          language: selectedLanguage || undefined,
        });
      } else {
        await startWave();
      }
      setWaveSettingsOpen(false);
    } catch (e) {
      console.error('Failed to start custom wave:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!waveSettingsOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={() => setWaveSettingsOpen(false)}
    >
      <div
        style={{
          width: 520,
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#121212',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          borderRadius: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                backgroundColor: 'rgba(163, 2, 26, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={18} color="#a3021a" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                Настройки Моей Волны
              </div>
              <div style={{ fontSize: 12, color: '#888888', marginTop: 2 }}>
                Выберите подходящее настроение и характер треков
              </div>
            </div>
          </div>

          <button
            onClick={() => setWaveSettingsOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: '#888888',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. НАСТРОЕНИЕ */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Настроение
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {MOODS.map((m) => {
              const isSelected = selectedMood === m.id;
              const IconComp = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMood(isSelected ? null : m.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '12px 6px',
                    borderRadius: 10,
                    border: isSelected ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#000000' : '#ffffff',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconComp size={18} color={isSelected ? '#000000' : m.color} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. ХАРАКТЕР МУЗЫКИ */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Характер
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {CHARACTERS.map((c) => {
              const isSelected = selectedCharacter === c.id;
              const IconComp = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCharacter(isSelected ? null : c.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 4,
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: isSelected ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#000000' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IconComp size={16} color={isSelected ? '#000000' : '#a3021a'} />
                  <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 600 }}>{c.label}</span>
                  <span style={{ fontSize: 10, opacity: isSelected ? 0.7 : 0.45 }}>{c.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. ЗАНЯТИЕ */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Занятие
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ACTIVITIES.map((a) => {
              const isSelected = selectedActivity === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedActivity(isSelected ? null : a.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 20,
                    border: isSelected ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#000000' : '#ffffff',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{a.icon}</span>
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. ЯЗЫК */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888888', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
            Язык
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {LANGUAGES.map((l) => {
              const isSelected = selectedLanguage === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setSelectedLanguage(isSelected ? null : l.id)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: isSelected ? '1px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundColor: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#000000' : '#ffffff',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 16, marginTop: 4 }}>
          <button
            onClick={handleResetToDefault}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              color: '#888888',
              fontSize: 12,
              cursor: 'pointer',
              padding: '6px 0',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888888')}
          >
            <RotateCcw size={13} />
            <span>Сбросить фильтры</span>
          </button>

          <button
            onClick={handleApply}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              borderRadius: 8,
              backgroundColor: '#ffffff',
              color: '#000000',
              border: 'none',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>Включить волну</span>
          </button>
        </div>
      </div>
    </div>
  );
};
