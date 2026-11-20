import { invoke, isTauri } from '@tauri-apps/api/core';
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
} from '../types';
import * as web from './webAdapter';

export type { CustomWaveOptions };

// Auth
export async function login(token: string): Promise<AuthStatus> {
  if (!isTauri()) return web.login(token);
  return invoke('cmd_login', { token });
}

export async function checkAuth(): Promise<AuthStatus> {
  if (!isTauri()) return web.checkAuth();
  return invoke('cmd_check_auth');
}

export async function logout(): Promise<void> {
  if (!isTauri()) return web.logout();
  return invoke('cmd_logout');
}

export async function extractTokenFromCookies(cookies: string): Promise<string> {
  if (!isTauri()) return web.extractTokenFromCookies(cookies);
  return invoke('cmd_extract_token_from_cookies', { cookies });
}

// Audio Stream & Cache
export async function getStreamUrl(trackId: string): Promise<string> {
  if (!isTauri()) return web.getStreamUrl(trackId);
  return invoke('cmd_get_stream_url', { trackId });
}

export async function getCacheStats(): Promise<CacheStats> {
  if (!isTauri()) return web.getCacheStats();
  return invoke('cmd_get_cache_stats');
}

export async function clearCache(): Promise<void> {
  if (!isTauri()) return web.clearCache();
  return invoke('cmd_clear_cache');
}

// Lyrics
export async function getLyrics(trackId: string): Promise<SyncedLyrics> {
  if (!isTauri()) return web.getLyrics(trackId);
  return invoke('cmd_get_lyrics', { trackId });
}

// Rotor («Моя волна»)
export async function startMyWave(): Promise<RotorStation> {
  if (!isTauri()) return web.startMyWave();
  return invoke('cmd_start_my_wave');
}

export async function getStationTracks(
  stationId: string,
  lastTrackId?: string
): Promise<RotorStation> {
  if (!isTauri()) return web.getStationTracks(stationId, lastTrackId);
  return invoke('cmd_get_station_tracks', {
    stationId,
    lastTrackId: lastTrackId || null,
  });
}

export async function sendRotorFeedback(
  stationId: string,
  batchId: string,
  trackId: string,
  albumId?: string,
  feedbackType = 'trackStarted',
  totalPlayedSeconds?: number
): Promise<void> {
  if (!isTauri()) {
    return web.sendRotorFeedback(
      stationId,
      batchId,
      trackId,
      albumId,
      feedbackType,
      totalPlayedSeconds
    );
  }
  return invoke('cmd_send_rotor_feedback', {
    stationId,
    batchId,
    trackId,
    albumId: albumId || null,
    feedbackType,
    totalPlayedSeconds: totalPlayedSeconds || null,
  });
}

// Library & Search
export async function getLikedTracks(): Promise<TrackItem[]> {
  if (!isTauri()) return web.getLikedTracks();
  return invoke('cmd_get_liked_tracks');
}

export async function likeTrack(trackId: string): Promise<void> {
  if (!isTauri()) return web.likeTrack(trackId);
  return invoke('cmd_like_track', { trackId });
}

export async function unlikeTrack(trackId: string): Promise<void> {
  if (!isTauri()) return web.unlikeTrack(trackId);
  return invoke('cmd_unlike_track', { trackId });
}

export async function getLanding(): Promise<LandingData> {
  if (!isTauri()) return web.getLanding();
  return invoke('cmd_get_landing');
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  if (!isTauri()) return web.getUserPlaylists();
  return invoke('cmd_get_user_playlists');
}

export async function getPlaylistTracks(kind: number, owner?: string): Promise<TrackItem[]> {
  if (!isTauri()) return web.getPlaylistTracks(kind, owner);
  return invoke('cmd_get_playlist_tracks', { kind, owner: owner || null });
}

export async function startEntityWave(entityType: string, entityId: string): Promise<RotorStation> {
  if (!isTauri()) return web.startEntityWave(entityType, entityId);
  return invoke('cmd_start_entity_wave', { entityType, entityId });
}

export async function searchMusic(query: string): Promise<SearchResults> {
  if (!isTauri()) return web.searchMusic(query);
  return invoke('cmd_search', { query });
}

export async function getSuggestions(query: string): Promise<string[]> {
  if (!isTauri()) return web.getSuggestions(query);
  return invoke('cmd_get_suggestions', { query });
}

// Custom Wave
export async function startCustomWave(
  options: CustomWaveOptions
): Promise<RotorStation> {
  if (!isTauri()) return web.startCustomWave(options);
  return invoke('cmd_start_custom_wave', { options });
}

// Audio Quality & Equalizer
export async function setAudioQuality(quality: string): Promise<void> {
  if (!isTauri()) return web.setAudioQuality(quality);
  return invoke('cmd_set_audio_quality', { quality });
}

export async function getAudioQuality(): Promise<string> {
  if (!isTauri()) return web.getAudioQuality();
  return invoke('cmd_get_audio_quality');
}

export async function saveEqualizer(settingsJson: string): Promise<void> {
  if (!isTauri()) return web.saveEqualizer(settingsJson);
  return invoke('cmd_save_equalizer', { settingsJson });
}

export async function loadEqualizer(): Promise<string | null> {
  if (!isTauri()) return web.loadEqualizer();
  return invoke('cmd_load_equalizer');
}
