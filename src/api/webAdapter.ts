import type {
  AuthStatus,
  CacheStats,
  CustomWaveOptions,
  LandingData,
  Playlist,
  RotorStation,
  SearchResults,
  SyncedLyrics,
  TrackItem,
  PersonalPlaylist,
  ChartTrack,
  Album,
  Artist,
  LyricLine,
} from '../types';
import { md5 } from '../utils/md5';

const SECRET = 'XGRlBW9FXlekgbPrRHuSiA';
const BASE_PROXY_URL = '/api/ym';

export function sanitizeToken(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('OAuth ')) {
    cleaned = cleaned.slice(6).trim();
  }
  if (cleaned.includes('access_token=')) {
    const match = cleaned.match(/access_token=([^&#\s]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return cleaned;
}

function getToken(): string | null {
  const t = localStorage.getItem('ym_token');
  return t ? sanitizeToken(t) : null;
}

function setToken(token: string): void {
  localStorage.setItem('ym_token', sanitizeToken(token));
}

function removeToken(): void {
  localStorage.removeItem('ym_token');
  localStorage.removeItem('ym_uid');
  localStorage.removeItem('ym_user_name');
  localStorage.removeItem('ym_login');
}

function getStoredUid(): string | null {
  return localStorage.getItem('ym_uid');
}

async function ymFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `OAuth ${token}`);
  }
  headers.set('X-Yandex-Music-Client', 'YandexMusicAndroid/24023621');

  const url = `${BASE_PROXY_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`YM API error (${response.status}): ${response.statusText}`);
  }

  return response.json();
}

export function parseTrack(val: any): TrackItem | null {
  if (!val) return null;
  const id = val.id != null ? String(val.id) : null;
  if (!id) return null;
  const title = val.title || 'Без названия';
  const duration_ms = val.durationMs || 0;
  const cover_uri = val.coverUri || val.ogImage || undefined;
  const artists: string[] = Array.isArray(val.artists)
    ? val.artists.map((a: any) => a.name).filter(Boolean)
    : [];
  let album_title: string | undefined;
  let album_id: string | undefined;
  if (Array.isArray(val.albums) && val.albums.length > 0) {
    const alb = val.albums[0];
    album_title = alb.title;
    album_id = alb.id != null ? String(alb.id) : undefined;
  }
  const available = val.available !== false;
  return {
    id,
    title,
    duration_ms,
    cover_uri,
    artists,
    album_title,
    album_id,
    available,
  };
}

function parseTimestamp(tag: string): number | null {
  const parts = tag.split(':');
  if (parts.length < 2) return null;
  const minutes = parseInt(parts[0], 10);
  const secPart = parts[1];
  let seconds = 0;
  let ms = 0;
  if (secPart.includes('.')) {
    const [secStr, fracStr] = secPart.split('.');
    seconds = parseInt(secStr, 10) || 0;
    if (fracStr.length === 1) ms = parseInt(fracStr, 10) * 100;
    else if (fracStr.length === 2) ms = parseInt(fracStr, 10) * 10;
    else ms = parseInt(fracStr.slice(0, 3), 10) || 0;
  } else {
    seconds = parseInt(secPart, 10) || 0;
  }
  return minutes * 60000 + seconds * 1000 + ms;
}

function parseLrc(lrcContent: string): SyncedLyrics {
  const lines: LyricLine[] = [];
  const rawLines: string[] = [];
  for (const line of lrcContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('[') && trimmed.includes(']')) {
      const idx = trimmed.indexOf(']');
      const tag = trimmed.slice(1, idx);
      const text = trimmed.slice(idx + 1).trim();
      const timeMs = parseTimestamp(tag);
      if (timeMs !== null) {
        if (text) rawLines.push(text);
        lines.push({ time_ms: timeMs, text });
        continue;
      }
    }
    rawLines.push(trimmed);
  }
  lines.sort((a, b) => a.time_ms - b.time_ms);
  const is_synced = lines.length > 0;
  return {
    is_synced,
    lines,
    raw_text: is_synced ? lines.map((l) => l.text).join('\n') : rawLines.join('\n'),
  };
}

export async function login(token: string): Promise<AuthStatus> {
  setToken(token);
  try {
    const data = await ymFetch('/account/status');
    const acc = data.result?.account;
    const uid = acc?.uid;
    const login = acc?.login;
    const name = acc?.fullName || acc?.displayName || login;

    if (uid) localStorage.setItem('ym_uid', String(uid));
    if (login) localStorage.setItem('ym_login', login);
    if (name) localStorage.setItem('ym_user_name', name);

    return {
      authenticated: true,
      uid,
      login,
      name,
      token,
    };
  } catch (err) {
    removeToken();
    throw new Error('Неверный токен или ошибка авторизации: ' + String(err));
  }
}

export async function checkAuth(): Promise<AuthStatus> {
  const token = getToken();
  if (!token) {
    return { authenticated: false };
  }
  try {
    const data = await ymFetch('/account/status');
    const acc = data.result?.account;
    const uid = acc?.uid;
    const login = acc?.login;
    const name = acc?.fullName || acc?.displayName || login;

    if (uid) localStorage.setItem('ym_uid', String(uid));
    if (login) localStorage.setItem('ym_login', login);
    if (name) localStorage.setItem('ym_user_name', name);

    return {
      authenticated: true,
      uid,
      login,
      name,
      token,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function logout(): Promise<void> {
  removeToken();
}

export async function extractTokenFromCookies(cookies: string): Promise<string> {
  const match = cookies.match(/access_token=([^;]+)/) || cookies.match(/OAuth\s+([A-Za-z0-9_-]+)/);
  if (match) return match[1].trim();
  const tokenMatch = cookies.match(/(y0_[A-Za-z0-9_-]+)/);
  if (tokenMatch) return tokenMatch[1].trim();
  throw new Error('Токен не найден в строке');
}

export async function getStreamUrl(trackId: string): Promise<string> {
  const token = getToken() || '';
  return `/api/stream?trackId=${encodeURIComponent(trackId)}&token=${encodeURIComponent(token)}`;
}

export async function getCacheStats(): Promise<CacheStats> {
  return {
    count: 0,
    total_bytes: 0,
    formatted_size: '0 MB (Web)',
  };
}

export async function clearCache(): Promise<void> {
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      for (const k of keys) {
        if (k !== 'ym-pwa-v1') {
          await caches.delete(k);
        }
      }
    } catch {}
  }
}

export async function getLyrics(trackId: string): Promise<SyncedLyrics> {
  // 1. Try to fetch track details to query LRCLIB for synced karaoke lyrics
  try {
    const trackData = await ymFetch(`/tracks/${trackId}`);
    const trackObj = Array.isArray(trackData.result) ? trackData.result[0] : trackData.result;
    if (trackObj) {
      const title = trackObj.title;
      const artist = trackObj.artists?.[0]?.name;
      const durationSec = Math.round((trackObj.durationMs || 0) / 1000);

      if (title && artist) {
        // Exact query
        let lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        if (durationSec > 0) lrcUrl += `&duration=${durationSec}`;

        try {
          const res = await fetch(lrcUrl);
          if (res.ok) {
            const data = await res.json();
            if (data.syncedLyrics && data.syncedLyrics.trim()) {
              return parseLrc(data.syncedLyrics);
            }
            if (data.plainLyrics && data.plainLyrics.trim()) {
              return {
                is_synced: false,
                lines: [],
                raw_text: data.plainLyrics,
              };
            }
          }
        } catch {}

        // Fuzzy search fallback
        try {
          const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          const searchRes = await fetch(searchUrl);
          if (searchRes.ok) {
            const list = await searchRes.json();
            if (Array.isArray(list) && list.length > 0) {
              const withSync = list.find((item: any) => item.syncedLyrics && item.syncedLyrics.trim());
              if (withSync) {
                return parseLrc(withSync.syncedLyrics);
              }
              const withPlain = list.find((item: any) => item.plainLyrics && item.plainLyrics.trim());
              if (withPlain) {
                return {
                  is_synced: false,
                  lines: [],
                  raw_text: withPlain.plainLyrics,
                };
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 2. Fallback: Yandex /supplement endpoint for official lyrics
  try {
    const supp = await ymFetch(`/tracks/${trackId}/supplement`);
    const lyricsVal = supp.result?.lyrics;
    if (lyricsVal) {
      if (lyricsVal.hasAvailableSyncLyrics && lyricsVal.downloadUrl) {
        const resp = await fetch(lyricsVal.downloadUrl);
        if (resp.ok) {
          const text = await resp.text();
          return parseLrc(text);
        }
      }
      const full = lyricsVal.fullLyrics || lyricsVal.lyrics || '';
      if (full.trim()) {
        return parseLrc(full);
      }
    }
  } catch {}

  return {
    is_synced: false,
    lines: [],
    raw_text: '',
  };
}

export async function startMyWave(): Promise<RotorStation> {
  return getStationTracks('user:onyourwave');
}

export async function getStationTracks(stationId: string, lastTrackId?: string): Promise<RotorStation> {
  let url = `/rotor/station/${encodeURIComponent(stationId)}/tracks?settings2=true`;
  if (lastTrackId) {
    url += `&queue=${encodeURIComponent(lastTrackId)}`;
  }
  const data = await ymFetch(url);
  const result = data.result || {};
  const batch_id = result.batchId || '';
  const tracks: TrackItem[] = [];

  if (Array.isArray(result.sequence)) {
    for (const item of result.sequence) {
      const trackVal = item.track || item;
      const parsed = parseTrack(trackVal);
      if (parsed) tracks.push(parsed);
    }
  }

  return {
    station_id: stationId,
    batch_id,
    tracks,
  };
}

export async function sendRotorFeedback(
  stationId: string,
  batchId: string,
  trackId: string,
  albumId?: string,
  feedbackType = 'trackStarted',
  totalPlayedSeconds?: number
): Promise<void> {
  let url = `/rotor/station/${encodeURIComponent(stationId)}/feedback`;
  if (batchId) {
    url += `?batch-id=${encodeURIComponent(batchId)}`;
  }
  const body: Record<string, any> = {
    type: feedbackType,
    timestamp: new Date().toISOString(),
  };
  if (trackId && trackId !== '0') body.trackId = trackId;
  if (albumId) body.albumId = albumId;
  if (typeof totalPlayedSeconds === 'number' && totalPlayedSeconds > 0) {
    body.totalPlayedSeconds = totalPlayedSeconds;
  }

  await ymFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export async function getLikedTracks(): Promise<TrackItem[]> {
  const uid = getStoredUid();
  if (!uid) return [];

  const data = await ymFetch(`/users/${uid}/likes/tracks`);
  const tracksArr = data.result?.library?.tracks || [];
  const trackIds: string[] = tracksArr.slice(0, 200).map((t: any) => String(t.id)).filter(Boolean);

  if (trackIds.length === 0) return [];

  const resultTracks: TrackItem[] = [];
  // Batch in chunks of 100
  for (let i = 0; i < trackIds.length; i += 100) {
    const chunk = trackIds.slice(i, i + 100);
    const detailData = await ymFetch(`/tracks?track-ids=${chunk.join(',')}`);
    if (Array.isArray(detailData.result)) {
      for (const t of detailData.result) {
        const parsed = parseTrack(t);
        if (parsed) resultTracks.push(parsed);
      }
    }
  }

  return resultTracks;
}

export async function likeTrack(trackId: string): Promise<void> {
  const uid = getStoredUid();
  if (!uid) return;
  const params = new URLSearchParams();
  params.append('track-ids', trackId);

  await ymFetch(`/users/${uid}/likes/tracks/add-multiple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

export async function unlikeTrack(trackId: string): Promise<void> {
  const uid = getStoredUid();
  if (!uid) return;
  const params = new URLSearchParams();
  params.append('track-ids', trackId);

  await ymFetch(`/users/${uid}/likes/tracks/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

export async function getLanding(): Promise<LandingData> {
  const uid = getStoredUid() || '0';
  const personal_playlists: PersonalPlaylist[] = [];
  const chart_tracks: ChartTrack[] = [];
  const new_releases: Album[] = [];

  // 1. Personal playlists from /feed
  try {
    const feedData = await ymFetch('/feed');
    const genPls = feedData.result?.generatedPlaylists || [];
    for (const item of genPls) {
      const plType = item.type || '';
      const p = item.data || item;
      const kind = p.kind;
      if (!kind) continue;

      const titleMap: Record<string, string> = {
        playlistOfTheDay: 'Плейлист дня',
        recentTracks: 'Премьера',
        neverHeard: 'Дежавю',
        missedLikes: 'Тайник',
      };
      const title = p.title || titleMap[plType] || 'Персональный микс';
      const description = p.description || undefined;
      const track_count = p.trackCount || 0;
      const cover_uri = p.cover?.uri || p.ogImage || undefined;
      const owner_login = p.owner?.login || p.owner?.name || uid;

      const headerMap: Record<string, string> = {
        playlistOfTheDay: 'ПЛЕЙЛИСТ ДНЯ',
        recentTracks: 'ПРЕМЬЕРА',
        neverHeard: 'ДЕЖАВЮ',
        missedLikes: 'ТАЙНИК',
      };
      const header = headerMap[plType] || item.header || undefined;

      personal_playlists.push({
        kind,
        owner_login,
        title,
        description,
        cover_uri,
        track_count,
        header,
      });
    }
  } catch {}

  // 2. Chart top-100 from /landing3/chart
  try {
    const chartData = await ymFetch('/landing3/chart');
    const tracksArr = chartData.result?.chart?.tracks || chartData.result?.tracks || [];
    for (let idx = 0; idx < tracksArr.length; idx++) {
      const item = tracksArr[idx];
      const trackVal = item.track || item;
      const trackDto = parseTrack(trackVal);
      if (trackDto) {
        const chartMeta = item.chart || item.chartProgress;
        const position = chartMeta?.position || idx + 1;
        const progress = chartMeta?.progress;
        const shift = chartMeta?.shift;
        chart_tracks.push({
          track: trackDto,
          position,
          progress,
          shift,
        });
      }
    }
  } catch {}

  // 3. New releases from /landing3/new-releases
  try {
    const releasesData = await ymFetch('/landing3/new-releases');
    const newReleasesArr = releasesData.result?.newReleases || [];
    for (const alb of newReleasesArr) {
      if (alb.id) {
        const id = String(alb.id);
        const title = alb.title || 'Новый релиз';
        const year = alb.year;
        const cover_uri = alb.coverUri || alb.ogImage;
        const artist_name = alb.artists?.[0]?.name;
        new_releases.push({ id, title, year, cover_uri, artist_name });
      }
    }
  } catch {}

  return {
    personal_playlists,
    chart_tracks,
    new_releases,
  };
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  const uid = getStoredUid();
  if (!uid) return [];
  const data = await ymFetch(`/users/${uid}/playlists/list`);
  const list = data.result || [];
  return list.map((p: any) => ({
    kind: p.kind,
    title: p.title || 'Плейлист',
    track_count: p.trackCount || 0,
    cover_uri: p.cover?.uri || p.ogImage,
    owner_name: p.owner?.name || p.owner?.login,
  }));
}

export async function getPlaylistTracks(kind: number, owner?: string): Promise<TrackItem[]> {
  const targetOwner = owner || getStoredUid() || '0';
  const data = await ymFetch(`/users/${targetOwner}/playlists/${kind}`);
  const tracksArr = data.result?.tracks || [];
  const tracks: TrackItem[] = [];
  for (const item of tracksArr) {
    const trackVal = item.track || item;
    const parsed = parseTrack(trackVal);
    if (parsed) tracks.push(parsed);
  }
  return tracks;
}

export async function startEntityWave(entityType: string, entityId: string): Promise<RotorStation> {
  const stationId = `${entityType}:${entityId}`;
  return getStationTracks(stationId);
}

export async function searchMusic(query: string): Promise<SearchResults> {
  const data = await ymFetch(`/search?text=${encodeURIComponent(query)}&type=all&page=0`);
  const result = data.result || {};
  const tracks: TrackItem[] = [];
  const artists: Artist[] = [];
  const albums: Album[] = [];

  const rawTracks = result.tracks?.results || [];
  for (const t of rawTracks) {
    const parsed = parseTrack(t);
    if (parsed) tracks.push(parsed);
  }

  const rawArtists = result.artists?.results || [];
  for (const a of rawArtists) {
    if (a.id) {
      artists.push({
        id: String(a.id),
        name: a.name || 'Артист',
        cover_uri: a.cover?.uri || a.ogImage,
        genres: a.genres || [],
      });
    }
  }

  const rawAlbums = result.albums?.results || [];
  for (const alb of rawAlbums) {
    if (alb.id) {
      albums.push({
        id: String(alb.id),
        title: alb.title || 'Альбом',
        year: alb.year,
        cover_uri: alb.coverUri || alb.ogImage,
        artist_name: alb.artists?.[0]?.name,
      });
    }
  }

  return { tracks, artists, albums };
}

export async function getSuggestions(query: string): Promise<string[]> {
  try {
    const data = await ymFetch(`/search/suggest?part=${encodeURIComponent(query)}`);
    return data.result?.suggestions || [];
  } catch {
    return [];
  }
}

export async function startCustomWave(options: CustomWaveOptions): Promise<RotorStation> {
  const stationId = 'user:onyourwave';
  if (options.mood || options.activity || options.character || options.language) {
    try {
      await ymFetch(`/rotor/station/${stationId}/settings3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodEnergy: options.mood || 'all',
          diversity: options.character || 'default',
          language: options.language || 'any',
          activity: options.activity || 'all',
          type: 'rotor',
        }),
      });
    } catch {}
  }
  return getStationTracks(stationId);
}

export async function setAudioQuality(quality: string): Promise<void> {
  localStorage.setItem('audio_quality', quality);
}

export async function getAudioQuality(): Promise<string> {
  return localStorage.getItem('audio_quality') || 'hq_320';
}

export async function saveEqualizer(settingsJson: string): Promise<void> {
  localStorage.setItem('equalizer_settings', settingsJson);
}

export async function loadEqualizer(): Promise<string | null> {
  return localStorage.getItem('equalizer_settings');
}
