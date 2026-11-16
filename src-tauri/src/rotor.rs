use anyhow::{anyhow, Result};
use chrono::Utc;
use serde_json::json;

use crate::auth::get_token;
use crate::http::{get_http_client, send_with_retry};
use crate::models::{RotorStationDto, TrackItemDto};

pub async fn start_my_wave() -> Result<RotorStationDto> {
    get_station_tracks("user:onyourwave", None, None, None).await
}

pub async fn set_station_settings(
    station_id: &str,
    diversity: &str,
    mood_energy: &str,
) -> Result<()> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/rotor/station/{}/settings3", station_id);
    let payload = json!({
        "moodEnergy": mood_energy,
        "diversity": diversity,
        "type": "rotor"
    });

    let resp = client
        .post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .json(&payload)
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(anyhow!("Ошибка сохранения настроек волны: статус {}", resp.status()))
    }
}

pub async fn start_custom_wave(
    station_id: &str,
    diversity: Option<String>,
    mood_energy: Option<String>,
) -> Result<RotorStationDto> {
    // If mood or diversity is provided, apply settings3 first
    if diversity.is_some() || mood_energy.is_some() {
        let div = diversity.as_deref().unwrap_or("default");
        let mood = mood_energy.as_deref().unwrap_or("all");
        let _ = set_station_settings(station_id, div, mood).await;
    }

    get_station_tracks(station_id, None, None, None).await
}

pub async fn get_station_tracks(
    station_id: &str,
    last_track_id: Option<String>,
    _diversity: Option<String>,
    _mood_energy: Option<String>,
) -> Result<RotorStationDto> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let mut url = format!("https://api.music.yandex.net/rotor/station/{}/tracks?settings2=true", station_id);
    if let Some(last_id) = last_track_id {
        if !last_id.is_empty() {
            url.push_str(&format!("&queue={}", last_id));
        }
    }

    let url_clone = url.clone();
    let token_clone = token.clone();

    send_with_retry(
        || {
            let u = url_clone.clone();
            let t = token_clone.clone();
            async move {
                let resp = client
                    .get(&u)
                    .header("Authorization", format!("OAuth {}", t))
                    .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
                    .send()
                    .await
                    .map_err(|e| anyhow!("Сетевая ошибка при запросе станции: {}", e))?;

                if !resp.status().is_success() {
                    return Err(anyhow!("Ошибка запроса станции: статус {}", resp.status()));
                }

                let val: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| anyhow!("Ошибка декодирования ответа станции: {}", e))?;
                let result = val.get("result").ok_or_else(|| anyhow!("Пустой ответ станции"))?;

                let batch_id = result["batchId"].as_str().unwrap_or("").to_string();
                let sequence = result["sequence"].as_array().cloned().unwrap_or_default();

                let mut tracks = Vec::new();
                for item in sequence {
                    if let Some(track_val) = item.get("track") {
                        if let Some(dto) = parse_track_dto(track_val) {
                            tracks.push(dto);
                        }
                    }
                }

                Ok(RotorStationDto {
                    station_id: station_id.to_string(),
                    batch_id,
                    tracks,
                })
            }
        },
        3,
    )
    .await
}

pub async fn send_rotor_feedback(
    station_id: &str,
    batch_id: &str,
    track_id: &str,
    album_id: Option<&str>,
    feedback_type: &str, // "trackStarted", "trackFinished", "skip", "like", "dislike"
    total_played_seconds: Option<f64>,
) -> Result<()> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let mut url = format!("https://api.music.yandex.net/rotor/station/{}/feedback", station_id);
    if !batch_id.is_empty() {
        url.push_str(&format!("?batch-id={}", batch_id));
    }

    let mut payload = json!({
        "type": feedback_type,
        "timestamp": Utc::now().to_rfc3339(),
    });

    if !track_id.is_empty() && track_id != "0" {
        payload["trackId"] = json!(track_id);
    }

    if let Some(aid) = album_id {
        payload["albumId"] = json!(aid);
    }
    if let Some(played) = total_played_seconds {
        if played > 0.0 {
            payload["totalPlayedSeconds"] = json!(played);
        }
    }

    let resp = client
        .post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .json(&payload)
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(anyhow!("Ошибка отправки фидбека: статус {}", resp.status()))
    }
}

pub fn parse_track_dto(val: &serde_json::Value) -> Option<TrackItemDto> {
    let id = val["id"].as_str().map(|s| s.to_string())
        .or_else(|| val["id"].as_u64().map(|n| n.to_string()))?;
    let title = val["title"].as_str().unwrap_or("Без названия").to_string();
    let duration_ms = val["durationMs"].as_u64().unwrap_or(0) as u32;

    let cover_uri = val["coverUri"].as_str().map(|s| s.to_string())
        .or_else(|| val["ogImage"].as_str().map(|s| s.to_string()));

    let mut artists = Vec::new();
    if let Some(artists_arr) = val["artists"].as_array() {
        for a in artists_arr {
            if let Some(name) = a["name"].as_str() {
                artists.push(name.to_string());
            }
        }
    }

    let mut album_title = None;
    let mut album_id = None;
    if let Some(albums) = val["albums"].as_array().and_then(|a| a.first()) {
        album_title = albums["title"].as_str().map(|s| s.to_string());
        album_id = albums["id"].as_str().map(|s| s.to_string())
            .or_else(|| albums["id"].as_u64().map(|n| n.to_string()));
    }

    let available = val["available"].as_bool().unwrap_or(true);

    Some(TrackItemDto {
        id,
        title,
        duration_ms,
        cover_uri,
        artists,
        album_title,
        album_id,
        available,
    })
}
