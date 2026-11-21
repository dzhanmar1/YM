import React, { useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { useWindowStore } from '../store/windowStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { SettingsPage } from '../pages/SettingsPage';

export function SettingsModal() {
  const isMobile = useIsMobile();
  const { settingsOpen, setSettingsOpen } = useWindowStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-2xl bg-dark-surface border border-dark-outline-variant/40 shadow-2xl flex flex-col overflow-hidden text-dark-on-surface ${
          isMobile
            ? 'rounded-t-3xl h-[88vh] animate-sheet-up pb-[calc(18px+var(--sab,0px))]'
            : 'rounded-2xl h-[84vh] max-h-[800px]'
        }`}
      >
        {/* Mobile Swipe Handle */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <span className="w-10 h-1 rounded-full bg-dark-outline-variant hover:bg-muted transition-colors" />
          </div>
        )}

        {/* Modal Header */}
        <div className="h-14 px-5 border-b border-dark-outline-variant/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
              <Settings size={16} />
            </div>
            <h2 className="font-headline text-title-md text-dark-on-surface font-bold">
              Настройки
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Закрыть (Esc)"
            className="w-8 h-8 rounded-lg bg-dark-surface-container-low border border-dark-outline-variant text-muted hover:text-dark-on-surface flex items-center justify-center active:scale-95 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Settings Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <SettingsPage />
        </div>
      </div>
    </div>
  );
}
