export interface TrackItem {
  id: string;
  title: string;
  duration_ms: number;
  cover_uri?: string;
  artists: string[];
  album_title?: string;
  album_id?: string;
  available: boolean;
}

export interface Playlist {
  kind: number;
  title: string;
  track_count: number;
  cover_uri?: string;
  owner_name?: string;
}

export interface Artist {
  id: string;
  name: string;
  cover_uri?: string;
  genres: string[];
}

export interface Album {
  id: string;
  title: string;
  year?: number;
  cover_uri?: string;
  artist_name?: string;
}

export interface SearchResults {
  tracks: TrackItem[];
  artists: Artist[];
  albums: Album[];
}

export interface LyricLine {
  time_ms: number;
  text: string;
}

export interface SyncedLyrics {
  is_synced: boolean;
  lines: LyricLine[];
  raw_text: string;
}

export interface RotorStation {
  station_id: string;
  batch_id: string;
  tracks: TrackItem[];
}

export interface PersonalPlaylist {
  kind: number;
  owner_login: string;
  title: string;
  description?: string;
  cover_uri?: string;
  track_count: number;
  header?: string;
}

export interface ChartTrack {
  track: TrackItem;
  position: number;
  progress?: 'same' | 'up' | 'down' | 'new' | string;
  shift?: number;
}

export interface LandingData {
  personal_playlists: PersonalPlaylist[];
  chart_tracks: ChartTrack[];
  new_releases: Album[];
}

export interface AuthStatus {
  authenticated: boolean;
  uid?: number;
  login?: string;
  name?: string;
  token?: string;
}

export interface CacheStats {
  count: number;
  total_bytes: number;
  formatted_size: string;
}

export interface CustomWaveOptions {
  activity?: string;
  mood?: string;
  character?: string;
  language?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';

export function formatCoverUrl(uri?: string, size = '200x200'): string {
  if (!uri) return '';
  const url = uri.startsWith('http') ? uri : `https://${uri}`;
  return url.replace('%%', size);
}

export type AudioQuality = 'hq_320' | 'medium_192' | 'low_128' | 'lossless';

export type EqualizerPreset =
  | 'flat'
  | 'bass_boost'
  | 'vocal_boost'
  | 'rock'
  | 'electronic'
  | 'acoustic'
  | 'chill'
  | 'custom';

export interface EqualizerSettings {
  enabled: boolean;
  preAmp: number;
  bands: number[];
  preset: EqualizerPreset;
}

export interface WaveSettings {
  activity?: string;
  character?: string;
  mood?: string;
  language?: string;
}

export type ViewMode = 'full' | 'mini' | 'docked';
export type SceneMode = 'default' | 'concentration' | 'workout' | 'relax';

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

