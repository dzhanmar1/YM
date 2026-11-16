import { useState, useEffect } from 'react';
import { Search as SearchIcon, X, Loader2, Disc, User } from 'lucide-react';
import * as api from '../api';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrackItemRow } from '../components/TrackItemRow';
import type { SearchResults } from '../types';
import { formatCoverUrl } from '../types';

interface SearchPageProps {
  query?: string;
  onQueryChange?: (q: string) => void;
}

export function SearchPage({ query: propQuery, onQueryChange }: SearchPageProps) {
  const isMobile = useIsMobile();
  const [internalQuery, setInternalQuery] = useState('');
  const query = propQuery !== undefined ? propQuery : internalQuery;
  const setQuery = (newQ: string) => {
    if (onQueryChange) onQueryChange(newQ);
    setInternalQuery(newQ);
  };
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'tracks' | 'artists' | 'albums'>('all');

  // Debounced live search & suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setResults(null);
      return;
    }

    // Quick suggestions timer (200ms)
    const sugTimer = setTimeout(async () => {
      try {
        const sugs = await api.getSuggestions(trimmed);
        setSuggestions(sugs.slice(0, 5));
      } catch {}
    }, 200);

    // Live search timer (450ms)
    const searchTimer = setTimeout(async () => {
      if (trimmed.length >= 2) {
        setLoading(true);
        try {
          const res = await api.searchMusic(trimmed);
          setResults(res);
        } catch (e) {
          console.error('Search failed:', e);
        } finally {
          setLoading(false);
        }
      }
    }, 450);

    return () => {
      clearTimeout(sugTimer);
      clearTimeout(searchTimer);
    };
  }, [query]);

  const executeSearch = async (searchTerm: string) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const res = await api.searchMusic(trimmed);
      setResults(res);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      executeSearch(query);
    }
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: isMobile ? '16px 14px 140px' : '36px 40px',
      overflowY: 'auto',
    }}>
      {/* Header & Search Bar */}
      <div style={{ maxWidth: 640, marginBottom: isMobile ? 16 : 28, position: 'relative' }}>
        {!isMobile && (
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.5, marginBottom: 16 }}>
            Поиск
          </h1>
        )}

        <div style={{ position: 'relative' }}>
          <SearchIcon size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Трек, исполнитель или альбом..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              padding: '11px 36px 11px 40px',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--border-high)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-medium)')}
          />
          {loading && (
            <div style={{ position: 'absolute', right: query ? 34 : 14, top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
              <Loader2 size={14} className="animate-spin" color="var(--text-muted)" />
            </div>
          )}
          {query && (
            <button
              onClick={() => { setQuery(''); setResults(null); }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <X size={14} />
            </button>
          )}

          {/* Autocomplete suggestions */}
          {suggestions.length > 0 && !results && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 6,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              zIndex: 30,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              {suggestions.map((sug, i) => (
                <div
                  key={i}
                  onClick={() => {
                    setQuery(sug);
                    executeSearch(sug);
                  }}
                  style={{
                    padding: '9px 16px',
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <SearchIcon size={12} color="var(--text-muted)" />
                  <span>{sug}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '40%',
          gap: 12,
          color: 'var(--text-muted)',
        }}>
          <Loader2 size={24} className="animate-spin" />
          <span style={{ fontSize: 12 }}>Поиск музыки...</span>
        </div>
      )}

      {/* Search results view */}
      {!loading && results && (
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {(['all', 'tracks', 'artists', 'albums'] as const).map((tab) => {
              const labels = {
                all: 'Всё',
                tracks: `Треки (${results.tracks.length})`,
                artists: `Артисты (${results.artists.length})`,
                albums: `Альбомы (${results.albums.length})`,
              };
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--border-medium)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Artists Section */}
          {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                Артисты
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: isMobile ? 8 : 16 }}>
                {results.artists.slice(0, activeTab === 'all' ? 6 : 24).map((artist) => (
                  <div
                    key={artist.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{
                      width: 68,
                      height: 68,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      backgroundColor: '#161616',
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {artist.cover_uri ? (
                        <img src={formatCoverUrl(artist.cover_uri, '150x150')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={28} color="var(--text-muted)" />
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                      {artist.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {artist.genres.slice(0, 1).join(', ') || 'Артист'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracks Section */}
          {(activeTab === 'all' || activeTab === 'tracks') && results.tracks.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                Треки
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {results.tracks.slice(0, activeTab === 'all' ? 10 : 50).map((track, i) => (
                  <TrackItemRow
                    key={track.id}
                    track={track}
                    index={i}
                    tracks={results.tracks}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Albums Section */}
          {(activeTab === 'all' || activeTab === 'albums') && results.albums.length > 0 && (
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                Альбомы
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: isMobile ? 10 : 16 }}>
                {results.albums.slice(0, activeTab === 'all' ? 6 : 24).map((album) => (
                  <div
                    key={album.id}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 12,
                    }}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      backgroundColor: '#161616',
                      marginBottom: 10,
                    }}>
                      {album.cover_uri ? (
                        <img src={formatCoverUrl(album.cover_uri, '200x200')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Disc size={28} color="var(--text-muted)" />
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {album.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {album.artist_name} {album.year ? `• ${album.year}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
