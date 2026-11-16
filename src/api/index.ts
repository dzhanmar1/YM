import { invoke } from '@tauri-apps/api/core';
import type {
  AuthStatus,
  CacheStats,
  LandingData,
  Playlist,
  RotorStation,
  SearchResults,
  SyncedLyrics,
  TrackItem,
} from '../types';

// Auth
export async function login(token: string): Promise<AuthStatus> {
  return invoke('cmd_login', { token });
}

export async function checkAuth(): Promise<AuthStatus> {
  return invoke('cmd_check_auth');
}

export async function logout(): Promise<void> {
  return invoke('cmd_logout');
}

export async function extractTokenFromCookies(cookies: string): Promise<string> {
  return invoke('cmd_extract_token_from_cookies', { cookies });
}

// Audio Stream & Cache
export async function getStreamUrl(trackId: string): Promise<string> {
  return invoke('cmd_get_stream_url', { trackId });
}

export async function getCacheStats(): Promise<CacheStats> {
  return invoke('cmd_get_cache_stats');
}

export async function clearCache(): Promise<void> {
  return invoke('cmd_clear_cache');
}

// Lyrics
export async function getLyrics(trackId: string): Promise<SyncedLyrics> {
  return invoke('cmd_get_lyrics', { trackId });
}

// Rotor («Моя волна»)
export async function startMyWave(): Promise<RotorStation> {
  return invoke('cmd_start_my_wave');
}

export async function getStationTracks(
  stationId: string,
  lastTrackId?: string
): Promise<RotorStation> {
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
  return invoke('cmd_get_liked_tracks');
}

export async function likeTrack(trackId: string): Promise<void> {
  return invoke('cmd_like_track', { trackId });
}

export async function unlikeTrack(trackId: string): Promise<void> {
  return invoke('cmd_unlike_track', { trackId });
}

export async function getLanding(): Promise<LandingData> {
  return invoke('cmd_get_landing');
}

export async function getUserPlaylists(): Promise<Playlist[]> {
  return invoke('cmd_get_user_playlists');
}

export async function getPlaylistTracks(kind: number, owner?: string): Promise<TrackItem[]> {
  return invoke('cmd_get_playlist_tracks', { kind, owner: owner || null });
}

export async function startEntityWave(entityType: string, entityId: string): Promise<RotorStation> {
  return invoke('cmd_start_entity_wave', { entityType, entityId });
}

export async function searchMusic(query: string): Promise<SearchResults> {
  return invoke('cmd_search', { query });
}

export async function getSuggestions(query: string): Promise<string[]> {
  return invoke('cmd_get_suggestions', { query });
}

export interface CustomWaveOptions {
  activity?: string;
  mood?: string;
  character?: string;
  language?: string;
}

// Custom Wave
export async function startCustomWave(
  options: CustomWaveOptions
): Promise<RotorStation> {
  return invoke('cmd_start_custom_wave', { options });
}

// Audio Quality & Equalizer
export async function setAudioQuality(quality: string): Promise<void> {
  return invoke('cmd_set_audio_quality', { quality });
}

export async function getAudioQuality(): Promise<string> {
  return invoke('cmd_get_audio_quality');
}

export async function saveEqualizer(settingsJson: string): Promise<void> {
  return invoke('cmd_save_equalizer', { settingsJson });
}

export async function loadEqualizer(): Promise<string | null> {
  return invoke('cmd_load_equalizer');
}

