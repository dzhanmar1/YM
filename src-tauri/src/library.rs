use anyhow::{anyhow, Result};

use crate::auth::{get_client, get_token};
use crate::http::get_http_client;
use crate::models::{
    AlbumDto, ArtistDto, ChartTrackDto, LandingDataDto, PersonalPlaylistDto, PlaylistDto,
    SearchResultsDto, TrackItemDto,
};
use crate::rotor::parse_track_dto;

pub async fn get_current_uid() -> Result<u64> {
    let client = get_client()?;
    let status = client.get_account_status().await.map_err(|e| anyhow!("{}", e))?;
    status
        .account
        .uid
        .ok_or_else(|| anyhow!("UID отсутствует"))
}

pub async fn get_liked_tracks() -> Result<Vec<TrackItemDto>> {
    let uid = get_current_uid().await?;
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/users/{}/likes/tracks", uid);
    let resp = client
        .get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    let library = json.get("result").and_then(|r| r.get("library"));
    let tracks_arr = library
        .and_then(|l| l.get("tracks"))
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();

    // Extract track IDs (first 200 for fast responsiveness)
    let track_ids: Vec<String> = tracks_arr
        .iter()
        .take(200)
        .filter_map(|item| {
            item["id"]
                .as_str()
                .map(|s| s.to_string())
                .or_else(|| item["id"].as_u64().map(|n| n.to_string()))
        })
        .collect();

    if track_ids.is_empty() {
        return Ok(Vec::new());
    }

    // Fetch full track details
    get_tracks_by_ids(&track_ids).await
}

pub async fn get_tracks_by_ids(ids: &[String]) -> Result<Vec<TrackItemDto>> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let mut result_tracks = Vec::new();

    // Chunk in batches of 100
    for chunk in ids.chunks(100) {
        let joined_ids = chunk.join(",");
        let url = format!("https://api.music.yandex.net/tracks?track-ids={}", joined_ids);

        let resp = client
            .get(&url)
            .header("Authorization", format!("OAuth {}", token))
            .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
            .send()
            .await?;

        let json: serde_json::Value = resp.json().await?;
        if let Some(arr) = json.get("result").and_then(|r| r.as_array()) {
            for track_val in arr {
                if let Some(dto) = parse_track_dto(track_val) {
                    result_tracks.push(dto);
                }
            }
        }
    }

    Ok(result_tracks)
}

pub async fn like_track(track_id: &str) -> Result<()> {
    let uid = get_current_uid().await?;
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/users/{}/likes/tracks/add-multiple", uid);
    let resp = client
        .post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .form(&[("track-ids", track_id)])
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(anyhow!("Ошибка добавления лайка: {}", resp.status()))
    }
}

pub async fn unlike_track(track_id: &str) -> Result<()> {
    let uid = get_current_uid().await?;
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/users/{}/likes/tracks/remove", uid);
    let resp = client
        .post(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .form(&[("track-ids", track_id)])
        .send()
        .await?;

    if resp.status().is_success() {
        Ok(())
    } else {
        Err(anyhow!("Ошибка удаления лайка: {}", resp.status()))
    }
}

pub async fn get_user_playlists() -> Result<Vec<PlaylistDto>> {
    let uid = get_current_uid().await?;
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/users/{}/playlists/list", uid);
    let resp = client
        .get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    let mut playlists = Vec::new();

    if let Some(arr) = json.get("result").and_then(|r| r.as_array()) {
        for p in arr {
            let kind = p["kind"].as_u64().unwrap_or(0);
            let title = p["title"].as_str().unwrap_or("Плейлист").to_string();
            let track_count = p["trackCount"].as_u64().unwrap_or(0) as u32;
            let cover_uri = p["cover"]["uri"].as_str().map(|s| s.to_string())
                .or_else(|| p["ogImage"].as_str().map(|s| s.to_string()));
            let owner_name = p["owner"]["name"].as_str().map(|s| s.to_string());

            playlists.push(PlaylistDto {
                kind,
                title,
                track_count,
                cover_uri,
                owner_name,
            });
        }
    }

    Ok(playlists)
}

pub async fn get_playlist_tracks(kind: u64) -> Result<Vec<TrackItemDto>> {
    let uid = get_current_uid().await?;
    get_playlist_tracks_by_owner(&uid.to_string(), kind).await
}

pub async fn get_playlist_tracks_by_owner(owner: &str, kind: u64) -> Result<Vec<TrackItemDto>> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let url = format!("https://api.music.yandex.net/users/{}/playlists/{}", owner, kind);
    let resp = client
        .get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    let mut tracks = Vec::new();

    if let Some(tracks_arr) = json.get("result").and_then(|r| r.get("tracks")).and_then(|t| t.as_array()) {
        for item in tracks_arr {
            let track_val = if item.get("track").is_some() {
                &item["track"]
            } else {
                item
            };
            if let Some(dto) = parse_track_dto(track_val) {
                tracks.push(dto);
            }
        }
    }

    Ok(tracks)
}

pub async fn get_landing() -> Result<LandingDataDto> {
    let uid = get_current_uid().await.unwrap_or(0);
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let mut personal_playlists = Vec::new();
    let mut chart_tracks = Vec::new();
    let mut new_releases = Vec::new();

    // 1. Fetch personal playlists from /feed
    let feed_url = "https://api.music.yandex.net/feed";
    if let Ok(resp) = client
        .get(feed_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await
    {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(gen_pls) = json.get("result").and_then(|r| r.get("generatedPlaylists")).and_then(|g| g.as_array()) {
                    for item in gen_pls {
                        let pl_type = item["type"].as_str().unwrap_or("");
                        let p = item.get("data").unwrap_or(item);
                        let kind = p["kind"].as_u64().unwrap_or(0);
                        if kind == 0 {
                            continue;
                        }

                        let default_title = match pl_type {
                            "playlistOfTheDay" => "Плейлист дня",
                            "recentTracks" => "Премьера",
                            "neverHeard" => "Дежавю",
                            "missedLikes" => "Тайник",
                            _ => "Персональный микс",
                        };
                        let title = p["title"].as_str().unwrap_or(default_title).to_string();
                        let description = p["description"].as_str().map(|s| s.to_string());
                        let track_count = p["trackCount"].as_u64().unwrap_or(0) as u32;
                        let cover_uri = p["cover"]["uri"]
                            .as_str()
                            .or_else(|| p["ogImage"].as_str())
                            .map(|s| s.to_string());

                        let owner_login = p["owner"]["login"]
                            .as_str()
                            .or_else(|| p["owner"]["name"].as_str())
                            .map(|s| s.to_string())
                            .or_else(|| p["owner"]["uid"].as_u64().map(|n| n.to_string()))
                            .unwrap_or_else(|| uid.to_string());

                        let header = match pl_type {
                            "playlistOfTheDay" => Some("ПЛЕЙЛИСТ ДНЯ".to_string()),
                            "recentTracks" => Some("ПРЕМЬЕРА".to_string()),
                            "neverHeard" => Some("ДЕЖАВЮ".to_string()),
                            "missedLikes" => Some("ТАЙНИК".to_string()),
                            _ => item["header"].as_str().map(|s| s.to_string()),
                        };

                        personal_playlists.push(PersonalPlaylistDto {
                            kind,
                            owner_login,
                            title,
                            description,
                            cover_uri,
                            track_count,
                            header,
                        });
                    }
                }
            }
        }
    }

    // 2. Fetch Chart Top-100 from /landing3/chart
    let chart_url = "https://api.music.yandex.net/landing3/chart";
    if let Ok(resp) = client
        .get(chart_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await
    {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                let chart_block = json.get("result").and_then(|r| r.get("chart"));
                let tracks_arr = chart_block
                    .and_then(|c| c.get("tracks"))
                    .or_else(|| json.get("result").and_then(|r| r.get("tracks")))
                    .and_then(|t| t.as_array());

                if let Some(tracks_arr) = tracks_arr {
                    for (idx, item) in tracks_arr.iter().enumerate() {
                        let track_val = if item.get("track").is_some() {
                            &item["track"]
                        } else {
                            item
                        };

                        if let Some(track_dto) = parse_track_dto(track_val) {
                            let chart_meta = item.get("chart").or_else(|| item.get("chartProgress"));
                            let position = chart_meta
                                .and_then(|c| c["position"].as_u64())
                                .map(|n| n as u32)
                                .unwrap_or(idx as u32 + 1);
                            let progress = chart_meta
                                .and_then(|c| c["progress"].as_str())
                                .map(|s| s.to_string());
                            let shift = chart_meta
                                .and_then(|c| c["shift"].as_i64())
                                .map(|n| n as i32);

                            chart_tracks.push(ChartTrackDto {
                                track: track_dto,
                                position,
                                progress,
                                shift,
                            });
                        }
                    }
                }
            }
        }
    }

    // 3. Fetch New Releases from /landing3/new-releases
    let releases_url = "https://api.music.yandex.net/landing3/new-releases";
    if let Ok(resp) = client
        .get(releases_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await
    {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(releases_arr) = json.get("result").and_then(|r| r.get("newReleases")).and_then(|nr| nr.as_array()) {
                    let mut album_ids: Vec<String> = Vec::new();
                    for item in releases_arr.iter().take(24) {
                        if let Some(id_num) = item.as_u64() {
                            album_ids.push(id_num.to_string());
                        } else if let Some(id_str) = item.as_str() {
                            album_ids.push(id_str.to_string());
                        } else if item.is_object() {
                            let id = item["id"].as_str().map(|s| s.to_string())
                                .or_else(|| item["id"].as_u64().map(|n| n.to_string()))
                                .unwrap_or_default();
                            if !id.is_empty() {
                                let title = item["title"].as_str().unwrap_or("Альбом").to_string();
                                let year = item["year"].as_u64().map(|n| n as u32);
                                let cover_uri = item["coverUri"].as_str().map(|s| s.to_string());
                                let artist_name = item["artists"]
                                    .as_array()
                                    .and_then(|arr| arr.first())
                                    .and_then(|a| a["name"].as_str())
                                    .map(|s| s.to_string());
                                new_releases.push(AlbumDto {
                                    id,
                                    title,
                                    year,
                                    cover_uri,
                                    artist_name,
                                });
                            }
                        }
                    }

                    if !album_ids.is_empty() && new_releases.is_empty() {
                        let batch_ids = album_ids.join(",");
                        let albums_url = format!("https://api.music.yandex.net/albums?album-ids={}", batch_ids);
                        if let Ok(alb_resp) = client
                            .get(&albums_url)
                            .header("Authorization", format!("OAuth {}", token))
                            .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
                            .send()
                            .await
                        {
                            if alb_resp.status().is_success() {
                                if let Ok(alb_json) = alb_resp.json::<serde_json::Value>().await {
                                    if let Some(albs) = alb_json.get("result").and_then(|r| r.as_array()) {
                                        for alb in albs {
                                            let id = alb["id"].as_str().map(|s| s.to_string())
                                                .or_else(|| alb["id"].as_u64().map(|n| n.to_string()))
                                                .unwrap_or_default();
                                            if id.is_empty() {
                                                continue;
                                            }
                                            let title = alb["title"].as_str().unwrap_or("Альбом").to_string();
                                            let year = alb["year"].as_u64().map(|n| n as u32);
                                            let cover_uri = alb["coverUri"].as_str().map(|s| s.to_string());
                                            let artist_name = alb["artists"]
                                                .as_array()
                                                .and_then(|arr| arr.first())
                                                .and_then(|a| a["name"].as_str())
                                                .map(|s| s.to_string());
                                            new_releases.push(AlbumDto {
                                                id,
                                                title,
                                                year,
                                                cover_uri,
                                                artist_name,
                                            });
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

    Ok(LandingDataDto {
        personal_playlists,
        chart_tracks,
        new_releases,
    })
}

pub async fn search_music(query: &str) -> Result<SearchResultsDto> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = get_http_client();

    let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
    let url = format!(
        "https://api.music.yandex.net/search?text={}&type=all&page=0",
        encoded
    );
    let resp = client
        .get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    let result = json.get("result").ok_or_else(|| anyhow!("Пустой результат поиска"))?;

    let mut tracks = Vec::new();
    if let Some(tracks_arr) = result.get("tracks").and_then(|t| t.get("results")).and_then(|r| r.as_array()) {
        for t in tracks_arr {
            if let Some(dto) = parse_track_dto(t) {
                tracks.push(dto);
            }
        }
    }

    let mut artists = Vec::new();
    if let Some(artists_arr) = result.get("artists").and_then(|a| a.get("results")).and_then(|r| r.as_array()) {
        for a in artists_arr {
            let id = a["id"].as_str().map(|s| s.to_string())
                .or_else(|| a["id"].as_u64().map(|n| n.to_string()))
                .unwrap_or_default();
            let name = a["name"].as_str().unwrap_or("Артист").to_string();
            let cover_uri = a["cover"]["uri"].as_str().map(|s| s.to_string())
                .or_else(|| a["ogImage"].as_str().map(|s| s.to_string()));
            let genres = a["genres"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|g| g.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            artists.push(ArtistDto { id, name, cover_uri, genres });
        }
    }

    let mut albums = Vec::new();
    if let Some(albums_arr) = result.get("albums").and_then(|a| a.get("results")).and_then(|r| r.as_array()) {
        for alb in albums_arr {
            let id = alb["id"].as_str().map(|s| s.to_string())
                .or_else(|| alb["id"].as_u64().map(|n| n.to_string()))
                .unwrap_or_default();
            let title = alb["title"].as_str().unwrap_or("Альбом").to_string();
            let year = alb["year"].as_u64().map(|y| y as u32);
            let cover_uri = alb["coverUri"].as_str().map(|s| s.to_string())
                .or_else(|| alb["ogImage"].as_str().map(|s| s.to_string()));
            let artist_name = alb["artists"]
                .as_array()
                .and_then(|arr| arr.first())
                .and_then(|art| art["name"].as_str())
                .map(|s| s.to_string());

            albums.push(AlbumDto { id, title, year, cover_uri, artist_name });
        }
    }

    Ok(SearchResultsDto { tracks, artists, albums })
}

pub async fn get_suggestions(query: &str) -> Result<Vec<String>> {
    let client = get_http_client();
    let encoded: String = url::form_urlencoded::byte_serialize(query.as_bytes()).collect();
    let url = format!(
        "https://api.music.yandex.net/search/suggest?part={}",
        encoded
    );

    let resp = client
        .get(&url)
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .send()
        .await?;

    let json: serde_json::Value = resp.json().await?;
    let mut suggestions = Vec::new();

    if let Some(arr) = json.get("result").and_then(|r| r.get("suggestions")).and_then(|s| s.as_array()) {
        for item in arr {
            if let Some(text) = item.as_str() {
                suggestions.push(text.to_string());
            }
        }
    }

    Ok(suggestions)
}
