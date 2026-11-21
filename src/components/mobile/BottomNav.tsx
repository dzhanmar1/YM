import React from 'react';
import { Radio, Search, Library } from 'lucide-react';

export type MobileTab = 'landing' | 'collection' | 'search';

interface BottomNavProps {
  currentTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  return (
    <nav
      aria-label="Основная навигация"
      className="rounded-full bg-dark-surface-container-low border border-dark-outline-variant p-gutter-xs shadow-lg select-none"
    >
      <ul className="grid grid-cols-3 items-center gap-gutter-xs">
        {/* 1. Поток (Landing) */}
        <li>
          <button
            type="button"
            onClick={() => onSelectTab('landing')}
            aria-current={currentTab === 'landing' ? 'page' : undefined}
            className={`w-full flex items-center justify-center gap-gutter-xs py-gutter-sm rounded-full transition-all duration-state-change ${
              currentTab === 'landing'
                ? 'bg-dark-surface-container-high text-dark-on-surface shadow-sm'
                : 'text-muted hover:text-dark-on-surface'
            }`}
          >
            <Radio
              size={18}
              className={currentTab === 'landing' ? 'text-accent' : 'currentColor'}
            />
            <span className="font-label text-label-md">Поток</span>
          </button>
        </li>

        {/* 2. Поиск (Search) */}
        <li>
          <button
            type="button"
            onClick={() => onSelectTab('search')}
            aria-current={currentTab === 'search' ? 'page' : undefined}
            className={`w-full flex items-center justify-center gap-gutter-xs py-gutter-sm rounded-full transition-all duration-state-change ${
              currentTab === 'search'
                ? 'bg-dark-surface-container-high text-dark-on-surface shadow-sm'
                : 'text-muted hover:text-dark-on-surface'
            }`}
          >
            <Search
              size={18}
              className={currentTab === 'search' ? 'text-accent' : 'currentColor'}
            />
            <span className="font-label text-label-md">Поиск</span>
          </button>
        </li>

        {/* 3. Коллекция (Collection) */}
        <li>
          <button
            type="button"
            onClick={() => onSelectTab('collection')}
            aria-current={currentTab === 'collection' ? 'page' : undefined}
            className={`w-full flex items-center justify-center gap-gutter-xs py-gutter-sm rounded-full transition-all duration-state-change ${
              currentTab === 'collection'
                ? 'bg-dark-surface-container-high text-dark-on-surface shadow-sm'
                : 'text-muted hover:text-dark-on-surface'
            }`}
          >
            <Library
              size={18}
              className={currentTab === 'collection' ? 'text-accent' : 'currentColor'}
            />
            <span className="font-label text-label-md">Коллекция</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
export default BottomNav;
