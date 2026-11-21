import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Heart,
  Sparkles,
  Zap,
  Radio,
  Check,
  Flame,
  Smile,
  Coffee,
  CloudRain,
  Loader2,
} from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { usePlayerStore } from '../store/playerStore';
import { useIsMobile } from '../hooks/useIsMobile';

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
  { id: 'fun', label: 'Радостное', icon: Smile, color: '#FF3B5C' },
  { id: 'calm', label: 'Спокойное', icon: Coffee, color: '#00b4d8' },
  { id: 'sad', label: 'Грустное', icon: CloudRain, color: '#a855f7' },
];

export const WaveSettingsModal: React.FC = () => {
  const isMobile = useIsMobile();
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
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in"
      onClick={() => setWaveSettingsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-lg bg-dark-surface border border-dark-outline-variant/40 shadow-2xl flex flex-col gap-5 overflow-y-auto no-scrollbar text-dark-on-surface ${
          isMobile
            ? 'rounded-t-3xl max-h-[90vh] animate-sheet-up pb-[calc(18px+var(--sab,0px))] px-5 pt-3'
            : 'rounded-2xl max-h-[88vh] p-6'
        }`}
      >
        {/* Mobile Swipe Handle */}
        {isMobile && (
          <div className="flex justify-center pb-1">
            <span className="w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-outline-variant/30 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Radio size={18} />
            </div>
            <div>
              <h2 className="font-headline text-title-md sm:text-title-lg text-dark-on-surface">
                Настройки Моей Волны
              </h2>
              <p className="font-body text-body-sm text-muted">
                Настройте звучание под ваши предпочтения
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWaveSettingsOpen(false)}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-lg bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. НАСТРОЕНИЕ */}
        <div className="flex flex-col gap-2">
          <span className="font-label text-label-xs text-muted uppercase tracking-wider">
            Настроение
          </span>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map((m) => {
              const isSelected = selectedMood === m.id;
              const IconComp = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMood(isSelected ? null : m.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm shadow-accent/20'
                      : 'bg-dark-surface-container-low border-dark-outline-variant text-dark-on-surface hover:border-dark-on-surface/40'
                  }`}
                >
                  <IconComp size={18} color={isSelected ? '#FF3B5C' : m.color} />
                  <span className="font-label text-label-sm">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. ХАРАКТЕР МУЗЫКИ */}
        <div className="flex flex-col gap-2">
          <span className="font-label text-label-xs text-muted uppercase tracking-wider">
            Характер
          </span>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTERS.map((c) => {
              const isSelected = selectedCharacter === c.id;
              const IconComp = c.icon;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCharacter(isSelected ? null : c.id)}
                  className={`flex flex-col items-center text-center gap-1 p-2.5 rounded-xl border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm shadow-accent/20'
                      : 'bg-dark-surface-container-low border-dark-outline-variant text-dark-on-surface hover:border-dark-on-surface/40'
                  }`}
                >
                  <IconComp size={16} className={isSelected ? 'text-accent' : 'text-muted'} />
                  <span className="font-label text-label-sm font-semibold">{c.label}</span>
                  <span className="font-body text-[10px] text-muted leading-tight line-clamp-1">
                    {c.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. ЗАНЯТИЕ */}
        <div className="flex flex-col gap-2">
          <span className="font-label text-label-xs text-muted uppercase tracking-wider">
            Занятие
          </span>
          <div className="flex flex-wrap gap-2">
            {ACTIVITIES.map((a) => {
              const isSelected = selectedActivity === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedActivity(isSelected ? null : a.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm shadow-accent/20'
                      : 'bg-dark-surface-container-low border-dark-outline-variant text-dark-on-surface hover:border-dark-on-surface/40'
                  }`}
                >
                  <span className="text-sm">{a.icon}</span>
                  <span className="font-label text-label-sm">{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. ЯЗЫК */}
        <div className="flex flex-col gap-2">
          <span className="font-label text-label-xs text-muted uppercase tracking-wider">
            Язык
          </span>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => {
              const isSelected = selectedLanguage === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLanguage(isSelected ? null : l.id)}
                  className={`py-2 px-3 rounded-xl border text-center transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-accent/20 border-accent text-accent font-bold shadow-sm shadow-accent/20'
                      : 'bg-dark-surface-container-low border-dark-outline-variant text-dark-on-surface hover:border-dark-on-surface/40'
                  }`}
                >
                  <span className="font-label text-label-sm">{l.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between border-t border-dark-outline-variant/30 pt-4 mt-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-muted hover:text-dark-on-surface font-label text-label-sm active:scale-95 transition-all"
          >
            <RotateCcw size={13} />
            <span>Сбросить</span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-dark-surface font-headline font-bold text-label-md shadow-lg shadow-accent/20 hover:brightness-110 active:scale-95 transition-all"
          >
            {loading && <Loader2 size={15} className="animate-spin text-dark-surface" />}
            <span>Включить волну</span>
          </button>
        </div>
      </div>
    </div>
  );
};
