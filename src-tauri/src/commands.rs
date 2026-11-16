use crate::auth;
use crate::db;
use crate::http;
use crate::library;
use crate::lyrics::SyncedLyrics;
use crate::models::{
    AuthStatus, CacheStatsDto, LandingDataDto, PlaylistDto, RotorStationDto, SearchResultsDto,
    TrackItemDto,
};
use crate::proxy;
use crate::rotor;
use tauri::{AppHandle, Emitter, Manager};

// ==================== AUTH ====================

#[tauri::command]
pub async fn cmd_login(token: String) -> Result<AuthStatus, String> {
    auth::login_with_token(&token)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_check_auth() -> Result<AuthStatus, String> {
    auth::check_auth().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cmd_logout() -> Result<(), String> {
    auth::logout().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_extract_token_from_cookies(cookies: String) -> Result<String, String> {
    auth::extract_token_from_cookies(&cookies)
        .await
        .map_err(|e| e.to_string())
}

// ==================== STREAM & CACHE ====================

#[tauri::command]
pub fn cmd_get_stream_url(track_id: String) -> String {
    proxy::get_stream_url(&track_id)
}

#[tauri::command]
pub fn cmd_get_cache_stats() -> Result<CacheStatsDto, String> {
    let (count, total_bytes) = db::get_cache_stats().map_err(|e| e.to_string())?;
    let formatted_size = if total_bytes > 1024 * 1024 * 1024 {
        format!("{:.2} ГБ", total_bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if total_bytes > 1024 * 1024 {
        format!("{:.1} МБ", total_bytes as f64 / (1024.0 * 1024.0))
    } else if total_bytes > 1024 {
        format!("{} КБ", total_bytes / 1024)
    } else {
        format!("{} байт", total_bytes)
    };

    Ok(CacheStatsDto {
        count,
        total_bytes,
        formatted_size,
    })
}

#[tauri::command]
pub fn cmd_clear_cache() -> Result<(), String> {
    db::clear_track_cache().map_err(|e| e.to_string())
}

// ==================== LYRICS ====================

#[tauri::command]
pub async fn cmd_get_lyrics(track_id: String) -> Result<SyncedLyrics, String> {
    let token = auth::get_token().ok_or_else(|| "Не авторизован".to_string())?;
    let client = http::get_http_client();

    // 1. Get track metadata to search in LRCLIB for millisecond-synced lyrics
    let track_info_url = format!("https://api.music.yandex.net/tracks/{}", track_id);
    if let Ok(track_resp) = client
        .get(&track_info_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await
    {
        if track_resp.status().is_success() {
            if let Ok(json) = track_resp.json::<serde_json::Value>().await {
                if let Some(track) = json.get("result").and_then(|r| r.as_array()).and_then(|a| a.first()) {
                    let title = track["title"].as_str().unwrap_or("");
                    let artist = track["artists"]
                        .as_array()
                        .and_then(|a| a.first())
                        .and_then(|art| art["name"].as_str())
                        .unwrap_or("");
                    let duration_sec = track["durationMs"].as_u64().map(|ms| ms / 1000).unwrap_or(0);

                    if !title.is_empty() && !artist.is_empty() {
                        let clean_title = title.split('(').next().unwrap_or(title).trim();
                        let enc_title: String = url::form_urlencoded::byte_serialize(clean_title.as_bytes()).collect();
                        let enc_artist: String = url::form_urlencoded::byte_serialize(artist.as_bytes()).collect();

                        let mut lrclib_url = format!(
                            "https://lrclib.net/api/get?track_name={}&artist_name={}",
                            enc_title, enc_artist
                        );
                        if duration_sec > 0 {
                            lrclib_url.push_str(&format!("&duration={}", duration_sec));
                        }

                        // 1a. Try exact get with User-Agent
                        if let Ok(lrc_resp) = client
                            .get(&lrclib_url)
                            .header("User-Agent", "YMDesktop/0.1.0 (https://github.com/ym-desktop)")
                            .send()
                            .await
                        {
                            if lrc_resp.status().is_success() {
                                if let Ok(lrc_json) = lrc_resp.json::<serde_json::Value>().await {
                                    if let Some(synced) = lrc_json["syncedLyrics"].as_str() {
                                        if !synced.trim().is_empty() {
                                            return Ok(crate::lyrics::parse_lrc(synced));
                                        }
                                    }
                                }
                            }
                        }

                        // 1b. Fallback to LRCLIB search query if exact match failed
                        let search_url = format!(
                            "https://lrclib.net/api/search?track_name={}&artist_name={}",
                            enc_title, enc_artist
                        );
                        if let Ok(search_resp) = client
                            .get(&search_url)
                            .header("User-Agent", "YMDesktop/0.1.0 (https://github.com/ym-desktop)")
                            .send()
                            .await
                        {
                            if search_resp.status().is_success() {
                                if let Ok(search_arr) = search_resp.json::<Vec<serde_json::Value>>().await {
                                    for item in search_arr {
                                        if let Some(synced) = item["syncedLyrics"].as_str() {
                                            if !synced.trim().is_empty() {
                                                return Ok(crate::lyrics::parse_lrc(synced));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Fallback: try supplement for plain lyrics from Yandex
    let supp_url = format!("https://api.music.yandex.net/tracks/{}/supplement", track_id);
    let supp_resp = client
        .get(&supp_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if supp_resp.status().is_success() {
        let supp_json: serde_json::Value = supp_resp.json().await.map_err(|e| e.to_string())?;
        if let Some(lyrics_val) = supp_json.get("result").and_then(|r| r.get("lyrics")) {
            let full_text = lyrics_val["fullLyrics"].as_str()
                .or_else(|| lyrics_val["lyrics"].as_str())
                .unwrap_or_default();
            if !full_text.is_empty() {
                return Ok(crate::lyrics::parse_lrc(full_text));
            }
        }
    }

    Err("Текст песни не найден".to_string())
}

// ==================== ROTOR («МОЯ ВОЛНА») ====================

#[tauri::command]
pub async fn cmd_start_my_wave() -> Result<RotorStationDto, String> {
    rotor::start_my_wave().await.map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
pub struct CustomWaveOptions {
    pub activity: Option<String>,
    pub mood: Option<String>,
    pub character: Option<String>,
    pub language: Option<String>,
}

#[tauri::command]
pub async fn cmd_start_custom_wave(
    options: CustomWaveOptions
) -> Result<RotorStationDto, String> {
    let mut station_id = "user:onyourwave".to_string();
    let mut diversity = options.character;
    let mut mood_energy = options.mood;

    if let Some(ref act) = options.activity {
        station_id = format!("activity:{}", act);
        diversity = None;
        mood_energy = None;
    } else if let Some(ref lang) = options.language {
        station_id = format!("local-language:{}", lang);
        diversity = None;
        mood_energy = None;
    }

    rotor::start_custom_wave(&station_id, diversity, mood_energy)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_station_tracks(
    station_id: String,
    last_track_id: Option<String>,
) -> Result<RotorStationDto, String> {
    rotor::get_station_tracks(&station_id, last_track_id, None, None)
        .await
        .map_err(|e| e.to_string())
}


#[tauri::command]
pub async fn cmd_send_rotor_feedback(
    station_id: String,
    batch_id: String,
    track_id: String,
    album_id: Option<String>,
    feedback_type: String,
    total_played_seconds: Option<f64>,
) -> Result<(), String> {
    rotor::send_rotor_feedback(
        &station_id,
        &batch_id,
        &track_id,
        album_id.as_deref(),
        &feedback_type,
        total_played_seconds,
    )
    .await
    .map_err(|e| e.to_string())
}

// ==================== LIBRARY & SEARCH ====================

#[tauri::command]
pub async fn cmd_get_liked_tracks() -> Result<Vec<TrackItemDto>, String> {
    library::get_liked_tracks().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_like_track(track_id: String) -> Result<(), String> {
    library::like_track(&track_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_unlike_track(track_id: String) -> Result<(), String> {
    library::unlike_track(&track_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_landing() -> Result<LandingDataDto, String> {
    library::get_landing().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_user_playlists() -> Result<Vec<PlaylistDto>, String> {
    library::get_user_playlists().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_playlist_tracks(
    kind: u64,
    owner: Option<String>,
) -> Result<Vec<TrackItemDto>, String> {
    if let Some(owner_name) = owner {
        library::get_playlist_tracks_by_owner(&owner_name, kind)
            .await
            .map_err(|e| e.to_string())
    } else {
        library::get_playlist_tracks(kind).await.map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn cmd_start_entity_wave(
    entity_type: String,
    entity_id: String,
) -> Result<RotorStationDto, String> {
    let station_id = format!("{}:{}", entity_type, entity_id);
    rotor::get_station_tracks(&station_id, None, None, None)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_search(query: String) -> Result<SearchResultsDto, String> {
    library::search_music(&query).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_suggestions(query: String) -> Result<Vec<String>, String> {
    library::get_suggestions(&query).await.map_err(|e| e.to_string())
}

// ==================== AUDIO QUALITY & EQUALIZER ====================

#[tauri::command]
pub async fn cmd_set_audio_quality(quality: String) -> Result<(), String> {
    db::set_setting("audio_quality", &quality).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_get_audio_quality() -> Result<String, String> {
    let q = db::get_setting("audio_quality")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "hq_320".to_string());
    Ok(q)
}

#[tauri::command]
pub async fn cmd_save_equalizer(settings_json: String) -> Result<(), String> {
    db::set_setting("equalizer_settings", &settings_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cmd_load_equalizer() -> Result<Option<String>, String> {
    db::get_setting("equalizer_settings").map_err(|e| e.to_string())
}

// ==================== WINDOW MANAGEMENT ====================

/// Hide main window, show mini player window positioned at bottom-right
#[tauri::command]
pub fn cmd_show_mini_player(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(mini_win) = app.get_webview_window("mini") {
            let width = 420.0;
            let height = 165.0;
            let _ = mini_win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
            let _ = mini_win.set_always_on_top(true);

            if let Ok(Some(monitor)) = mini_win.current_monitor() {
                let scale = monitor.scale_factor();
                let mon_size = monitor.size();
                let mon_pos = monitor.position();
                let mon_w = mon_size.width as f64 / scale;
                let mon_h = mon_size.height as f64 / scale;
                let mon_x = mon_pos.x as f64 / scale;
                let mon_y = mon_pos.y as f64 / scale;

                let init_x = mon_x + mon_w - width - 20.0;
                let init_y = mon_y + mon_h - height - 64.0;

                #[cfg(target_os = "windows")]
                let mut applied = false;
                #[cfg(target_os = "windows")]
                {
                    if let Ok(hwnd) = mini_win.hwnd() {
                        let phys_x = (init_x * scale).round() as i32;
                        let phys_y = (init_y * scale).round() as i32;
                        let phys_w = (width * scale).round() as i32;
                        let phys_h = (height * scale).round() as i32;

                        extern "system" {
                            fn SetWindowPos(
                                hwnd: *mut std::ffi::c_void,
                                hwnd_insert_after: *mut std::ffi::c_void,
                                x: i32,
                                y: i32,
                                cx: i32,
                                cy: i32,
                                u_flags: u32,
                            ) -> i32;
                        }

                        // SWP_NOZORDER (0x0004) | SWP_NOACTIVATE (0x0010)
                        unsafe {
                            SetWindowPos(
                                hwnd.0 as *mut std::ffi::c_void,
                                std::ptr::null_mut(),
                                phys_x,
                                phys_y,
                                phys_w,
                                phys_h,
                                0x0004 | 0x0010,
                            );
                        }
                        applied = true;
                    }
                }

                #[cfg(target_os = "windows")]
                if !applied {
                    let _ = mini_win.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: init_x, y: init_y }));
                    let _ = mini_win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
                }

                #[cfg(not(target_os = "windows"))]
                {
                    let _ = mini_win.set_position(tauri::Position::Logical(tauri::LogicalPosition { x: init_x, y: init_y }));
                    let _ = mini_win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }));
                }
            }

            let _ = mini_win.set_always_on_top(true);
            mini_win.show().map_err(|e| e.to_string())?;
            mini_win.set_focus().map_err(|e| e.to_string())?;
            let _ = mini_win.unminimize();
            let _ = mini_win.emit("mini-show", ());
        }
        if let Some(main_win) = app.get_webview_window("main") {
            main_win.hide().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

/// Hide mini player window, show main window
#[tauri::command]
pub fn cmd_hide_mini_player(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.unminimize();
            main_win.show().map_err(|e| e.to_string())?;
            main_win.set_focus().map_err(|e| e.to_string())?;
        }
        if let Some(mini_win) = app.get_webview_window("mini") {
            let _ = mini_win.hide();
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

/// Relay an action from mini window → emit event to main window
#[tauri::command]
pub fn cmd_mini_action(app: AppHandle, action: String, payload: Option<String>) -> Result<(), String> {
    let event_payload = serde_json::json!({ "action": action, "payload": payload });
    let _ = app.emit("mini-action", &event_payload);
    #[cfg(desktop)]
    {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.emit("mini-action", &event_payload);
        }
    }
    Ok(())
}

/// Emit current player state to mini window
#[tauri::command]
pub fn cmd_emit_player_state(app: AppHandle, state_json: String) -> Result<(), String> {
    let val: serde_json::Value = serde_json::from_str(&state_json)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("player-state", &val);
    #[cfg(desktop)]
    {
        if let Some(mini_win) = app.get_webview_window("mini") {
            let _ = mini_win.emit("player-state", &val);
        }
    }
    Ok(())
}

/// Emit lightweight playback time update to mini window
#[tauri::command]
pub fn cmd_emit_player_time(app: AppHandle, current_time: f64, active_line_index: i32) -> Result<(), String> {
    let payload = serde_json::json!({
        "currentTime": current_time,
        "activeLineIndex": active_line_index,
    });
    let _ = app.emit("player-time", &payload);
    #[cfg(desktop)]
    {
        if let Some(mini_win) = app.get_webview_window("mini") {
            let _ = mini_win.emit("player-time", &payload);
        }
    }
    Ok(())
}

/// Resize mini window to given logical dimensions
#[tauri::command]
pub fn cmd_resize_mini(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(win) = app.get_webview_window("mini") {
            win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        let _ = width;
        let _ = height;
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_resize_mini_anchored(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(win) = app.get_webview_window("mini") {
            let factor = win.scale_factor().unwrap_or(1.0);
            if let (Ok(curr_pos), Ok(curr_size)) = (win.outer_position(), win.outer_size()) {
                let curr_logical_w = curr_size.width as f64 / factor;
                let curr_logical_h = curr_size.height as f64 / factor;
                let curr_logical_x = curr_pos.x as f64 / factor;
                let curr_logical_y = curr_pos.y as f64 / factor;

                let new_logical_y = curr_logical_y + (curr_logical_h - height);
                let new_logical_x = curr_logical_x + (curr_logical_w - width);

                #[cfg(target_os = "windows")]
                {
                    if let Ok(hwnd) = win.hwnd() {
                        let phys_x = (new_logical_x * factor).round() as i32;
                        let phys_y = (new_logical_y * factor).round() as i32;
                        let phys_w = (width * factor).round() as i32;
                        let phys_h = (height * factor).round() as i32;

                        extern "system" {
                            fn SetWindowPos(
                                hwnd: *mut std::ffi::c_void,
                                hwnd_insert_after: *mut std::ffi::c_void,
                                x: i32,
                                y: i32,
                                cx: i32,
                                cy: i32,
                                u_flags: u32,
                            ) -> i32;
                        }

                        // SWP_NOZORDER (0x0004) | SWP_NOACTIVATE (0x0010) | SWP_NOOWNERZORDER (0x0200)
                        unsafe {
                            SetWindowPos(
                                hwnd.0 as *mut std::ffi::c_void,
                                std::ptr::null_mut(),
                                phys_x,
                                phys_y,
                                phys_w,
                                phys_h,
                                0x0004 | 0x0010 | 0x0200,
                            );
                        }
                        return Ok(());
                    }
                }

                let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                    x: new_logical_x,
                    y: new_logical_y,
                }));
                win.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        let _ = width;
        let _ = height;
    }
    Ok(())
}

/// Emergency recovery: show main window regardless of state
#[tauri::command]
pub fn cmd_restore_main(app: AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(mini_win) = app.get_webview_window("mini") {
            let _ = mini_win.hide();
        }
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.unminimize();
            main_win.show().map_err(|e| e.to_string())?;
            main_win.set_focus().map_err(|e| e.to_string())?;
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
    }
    Ok(())
}

/// Update system tray icon tooltip (e.g. current playing track)
#[tauri::command]
pub fn cmd_update_tray_tooltip(app: AppHandle, tooltip: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if let Some(tray) = app.tray_by_id("main_tray") {
            let _ = tray.set_tooltip(Some(tooltip));
        }
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        let _ = tooltip;
    }
    Ok(())
}

