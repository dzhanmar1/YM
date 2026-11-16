mod auth;
mod commands;
mod db;
mod http;
mod library;
mod lyrics;
mod models;
mod proxy;
mod rotor;

use commands::*;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Resolve app data directory
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory")
                .to_string_lossy()
                .to_string();

            // Initialize SQLite DB
            if let Err(e) = db::init_db(&data_dir) {
                eprintln!("Failed to initialize database: {}", e);
            }

            // Initialize local streaming proxy server with disk cache
            if let Err(e) = proxy::init_proxy(&data_dir) {
                eprintln!("Failed to initialize streaming proxy: {}", e);
            }

            // Desktop only: System Tray & Floating Mini Window
            #[cfg(desktop)]
            {
                let play_i = MenuItem::with_id(app, "play_pause", "Воспроизведение / Пауза", true, None::<&str>)?;
                let next_i = MenuItem::with_id(app, "next_track", "Следующий трек", true, None::<&str>)?;
                let prev_i = MenuItem::with_id(app, "prev_track", "Предыдущий трек", true, None::<&str>)?;
                let sep_controls = PredefinedMenuItem::separator(app)?;

                let open_i = MenuItem::with_id(app, "open_main", "Открыть YM", true, None::<&str>)?;
                let mini_i = MenuItem::with_id(app, "toggle_mini", "Мини-плеер", true, None::<&str>)?;
                let sep_i = PredefinedMenuItem::separator(app)?;
                let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;

                let menu = Menu::with_items(app, &[
                    &play_i,
                    &next_i,
                    &prev_i,
                    &sep_controls,
                    &open_i,
                    &mini_i,
                    &sep_i,
                    &quit_i,
                ])?;

                if let Some(icon) = app.default_window_icon() {
                    let _tray = TrayIconBuilder::with_id("main_tray")
                        .icon(icon.clone())
                        .menu(&menu)
                        .show_menu_on_left_click(false)
                        .tooltip("YM Desktop")
                        .on_menu_event(|app, event| match event.id.as_ref() {
                            "play_pause" => {
                                let _ = cmd_mini_action(app.clone(), "toggle_play".to_string(), None);
                            }
                            "next_track" => {
                                let _ = cmd_mini_action(app.clone(), "next".to_string(), None);
                            }
                            "prev_track" => {
                                let _ = cmd_mini_action(app.clone(), "prev".to_string(), None);
                            }
                            "open_main" => {
                                let _ = cmd_restore_main(app.clone());
                            }
                            "toggle_mini" => {
                                let _ = cmd_show_mini_player(app.clone());
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        })
                        .on_tray_icon_event(|tray, event| {
                            if let TrayIconEvent::Click {
                                button: MouseButton::Left,
                                button_state: MouseButtonState::Up,
                                ..
                            } = event
                            {
                                let app = tray.app_handle();
                                let _ = cmd_restore_main(app.clone());
                            }
                        })
                        .build(app)?;
                }

                // Prevent mini window from destroying when closed, restore main instead
                if let Some(mini) = app.get_webview_window("mini") {
                    let app_handle = app.handle().clone();
                    mini.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = cmd_restore_main(app_handle.clone());
                        }
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            cmd_login,
            cmd_check_auth,
            cmd_logout,
            cmd_extract_token_from_cookies,
            // Stream & Cache
            cmd_get_stream_url,
            cmd_get_cache_stats,
            cmd_clear_cache,
            // Lyrics
            cmd_get_lyrics,
            // Rotor («Моя волна»)
            cmd_start_my_wave,
            cmd_start_custom_wave,
            cmd_start_entity_wave,
            cmd_get_station_tracks,
            cmd_send_rotor_feedback,
            // Library & Landing
            cmd_get_landing,
            cmd_get_liked_tracks,
            cmd_like_track,
            cmd_unlike_track,
            cmd_get_user_playlists,
            cmd_get_playlist_tracks,
            // Search
            cmd_search,
            cmd_get_suggestions,
            // Audio Quality & Equalizer
            cmd_set_audio_quality,
            cmd_get_audio_quality,
            cmd_save_equalizer,
            cmd_load_equalizer,
            // Window Management
            cmd_show_mini_player,
            cmd_hide_mini_player,
            cmd_mini_action,
            cmd_emit_player_state,
            cmd_emit_player_time,
            cmd_resize_mini,
            cmd_resize_mini_anchored,
            cmd_restore_main,
            cmd_update_tray_tooltip,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
