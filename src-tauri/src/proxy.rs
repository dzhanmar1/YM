use anyhow::{anyhow, Result};
use axum::{
    body::Body,
    extract::{Path, Request},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use parking_lot::RwLock;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeFile;

use crate::auth::get_token;
use crate::db;
use crate::http;

static PROXY_PORT: AtomicU16 = AtomicU16::new(0);
static CACHE_DIR: RwLock<Option<PathBuf>> = RwLock::new(None);

pub fn init_proxy(data_dir: &str) -> Result<u16> {
    let cache_dir = PathBuf::from(data_dir).join("audio_cache");
    std::fs::create_dir_all(&cache_dir)?;
    *CACHE_DIR.write() = Some(cache_dir);

    // Bind to available port
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    PROXY_PORT.store(port, Ordering::SeqCst);
    drop(listener);

    // Spawn server in dedicated background thread with its own Tokio runtime
    std::thread::spawn(move || {
        let rt = match tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
        {
            Ok(rt) => rt,
            Err(e) => {
                eprintln!("Failed to create Tokio runtime for streaming proxy: {}", e);
                return;
            }
        };

        rt.block_on(async move {
            let app = Router::new()
                .route("/stream/:track_id", get(stream_handler))
                .route("/health", get(|| async { "OK" }))
                .layer(CorsLayer::permissive());

            let addr = SocketAddr::from(([127, 0, 0, 1], port));
            let listener = match tokio::net::TcpListener::bind(addr).await {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("Failed to bind proxy listener: {}", e);
                    return;
                }
            };

            println!("Streaming proxy server listening on http://{}", addr);
            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("Proxy server error: {}", e);
            }
        });
    });

    Ok(port)
}

pub fn get_proxy_port() -> u16 {
    PROXY_PORT.load(Ordering::SeqCst)
}

pub fn get_stream_url(track_id: &str) -> String {
    let port = get_proxy_port();
    format!("http://127.0.0.1:{}/stream/{}", port, track_id)
}

async fn stream_handler(Path(track_id): Path<String>, req: Request) -> Response {
    let cache_dir = {
        let guard = CACHE_DIR.read();
        guard.clone().unwrap_or_else(|| PathBuf::from("./audio_cache"))
    };

    let cached_file = cache_dir.join(format!("{}.mp3", track_id));

    // 1. If file is in disk cache, serve it via ServeFile (handles Range, Seeking, 206)
    if cached_file.exists() {
        if let Ok(metadata) = std::fs::metadata(&cached_file) {
            if metadata.len() > 10_000 {
                return match ServeFile::new(&cached_file).try_call(req).await {
                    Ok(resp) => resp.into_response(),
                    Err(e) => {
                        eprintln!("Error serving cached file: {}", e);
                        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to read cached file").into_response()
                    }
                };
            }
        }
    }

    // 2. Not cached: resolve direct MP3 URL from Yandex
    let direct_url = match resolve_track_direct_url(&track_id).await {
        Ok(url) => url,
        Err(e) => {
            eprintln!("Failed to resolve track direct URL for {}: {}", track_id, e);
            return (StatusCode::BAD_GATEWAY, format!("Failed to resolve track URL: {}", e)).into_response();
        }
    };

    // 3. Proxy request to Yandex MDS with Range header if present
    let client = http::get_stream_client();
    let mut upstream_req = client.get(&direct_url);

    let range_header = req.headers().get(header::RANGE).cloned();
    if let Some(ref range) = range_header {
        upstream_req = upstream_req.header(header::RANGE, range);
    }

    let upstream_res = match upstream_req.send().await {
        Ok(res) => res,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, format!("Error connecting to audio source: {}", e)).into_response();
        }
    };

    let status = upstream_res.status();
    let upstream_headers = upstream_res.headers().clone();

    // Check if this is a full request or start of file to trigger background caching
    let is_start = range_header.as_ref().map(|h| {
        let s = h.to_str().unwrap_or("");
        s.is_empty() || s.starts_with("bytes=0-")
    }).unwrap_or(true);

    if is_start && (status == StatusCode::OK || status == StatusCode::PARTIAL_CONTENT) {
        // Asynchronously download full track into cache in the background
        let bg_url = direct_url.clone();
        let bg_dest = cached_file.clone();
        let bg_track_id = track_id.clone();
        tokio::spawn(async move {
            let _ = download_and_cache_track(&bg_url, &bg_dest, &bg_track_id).await;
        });
    }

    // Determine correct audio MIME type (never send application/octet-stream to WebView audio engine)
    let audio_mime = if direct_url.contains(".flac") || direct_url.contains("/flac/") {
        "audio/flac"
    } else {
        "audio/mpeg"
    };

    // Convert upstream stream to axum Response
    let mut response_builder = Response::builder().status(status);

    for (name, val) in upstream_headers.iter() {
        if name == header::CONTENT_LENGTH
            || name == header::CONTENT_RANGE
            || name == header::ACCEPT_RANGES
        {
            response_builder = response_builder.header(name, val);
        }
    }

    // Explicitly set audio content type for HTML5 audio element
    response_builder = response_builder.header(header::CONTENT_TYPE, audio_mime);

    // Always guarantee Accept-Ranges: bytes header is present for WebView audio engine seeking
    response_builder = response_builder.header(header::ACCEPT_RANGES, "bytes");

    let body = Body::from_stream(upstream_res.bytes_stream());
    response_builder.body(body).unwrap_or_else(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "Failed to stream audio").into_response()
    })
}

async fn download_and_cache_track(url: &str, dest_path: &PathBuf, track_id: &str) -> Result<()> {
    let tmp_path = dest_path.with_extension("tmp");
    let client = http::get_stream_client();
    let resp = client.get(url).send().await?;

    if !resp.status().is_success() {
        return Err(anyhow!("Failed to download track for cache: status {}", resp.status()));
    }

    let bytes = resp.bytes().await?;
    let size = bytes.len() as u64;

    std::fs::write(&tmp_path, &bytes)?;
    std::fs::rename(&tmp_path, dest_path)?;

    // Register in database
    let _ = db::record_cached_track(track_id, dest_path.to_str().unwrap_or(""), size);
    Ok(())
}

/// Resolves direct stream URL by querying Yandex download info and signing with MD5
async fn resolve_track_direct_url(track_id: &str) -> Result<String> {
    let token = get_token().ok_or_else(|| anyhow!("Не авторизован"))?;
    let client = http::get_http_client();

    // 1. Get download info XML URL
    let info_url = format!("https://api.music.yandex.net/tracks/{}/download-info", track_id);
    let resp = client
        .get(&info_url)
        .header("Authorization", format!("OAuth {}", token))
        .header("X-Yandex-Music-Client", "YandexMusicAndroid/24022432")
        .header("User-Agent", "Yandex-Music-API")
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(anyhow!("Failed to fetch download-info: status {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await?;
    let result = json
        .get("result")
        .and_then(|r| r.as_array())
        .ok_or_else(|| anyhow!("Download info not found in response: {:?}", json))?;

    // Read user audio quality preference (hq_320, medium_192, low_128, lossless)
    let preferred_quality = crate::db::get_setting("audio_quality")
        .unwrap_or(None)
        .unwrap_or_else(|| "hq_320".to_string());

    // Select best info based on user preference
    let best_info = match preferred_quality.as_str() {
        "lossless" => {
            result.iter().find(|item| item["codec"].as_str() == Some("flac"))
                .or_else(|| {
                    result.iter().filter(|item| item["codec"].as_str() == Some("mp3"))
                        .max_by_key(|item| {
                            item["bitrateInKbps"].as_u64().or_else(|| item["bitrate_in_kbps"].as_u64()).unwrap_or(0)
                        })
                })
        }
        "low_128" => {
            result.iter().filter(|item| item["codec"].as_str() == Some("mp3"))
                .min_by_key(|item| {
                    item["bitrateInKbps"].as_u64().or_else(|| item["bitrate_in_kbps"].as_u64()).unwrap_or(320)
                })
        }
        "medium_192" => {
            result.iter().filter(|item| item["codec"].as_str() == Some("mp3"))
                .min_by_key(|item| {
                    let br = item["bitrateInKbps"].as_u64().or_else(|| item["bitrate_in_kbps"].as_u64()).unwrap_or(320);
                    (br as i64 - 192).abs()
                })
        }
        _ => {
            // Default: hq_320
            result.iter().filter(|item| item["codec"].as_str() == Some("mp3"))
                .max_by_key(|item| {
                    item["bitrateInKbps"].as_u64().or_else(|| item["bitrate_in_kbps"].as_u64()).unwrap_or(0)
                })
        }
    }
    .or_else(|| result.first())
    .ok_or_else(|| anyhow!("No download info items available"))?;


    let download_info_url = best_info["downloadInfoUrl"]
        .as_str()
        .or_else(|| best_info["download_info_url"].as_str())
        .ok_or_else(|| anyhow!("downloadInfoUrl missing in: {:?}", best_info))?;

    const SECRET: &str = "XGRlBW9FXlekgbPrRHuSiA";

    // 2. Try JSON format first (?format=json)
    let json_url = if download_info_url.contains('?') {
        format!("{}&format=json", download_info_url)
    } else {
        format!("{}?format=json", download_info_url)
    };

    if let Ok(json_res) = client.get(&json_url).send().await {
        if json_res.status().is_success() {
            if let Ok(json_val) = json_res.json::<serde_json::Value>().await {
                if let (Some(host), Some(path), Some(ts)) = (
                    json_val["host"].as_str(),
                    json_val["path"].as_str(),
                    json_val["ts"].as_str(),
                ) {
                    let path_clean = path.trim_start_matches('/');
                    let sign_str = format!("{}{}{}", SECRET, path_clean, ts);
                    let digest = md5::compute(sign_str.as_bytes());
                    let sign = format!("{:x}", digest);
                    return Ok(format!("https://{}/get-mp3/{}/{}{}", host, sign, ts, path));
                }
            }
        }
    }

    // 3. Fallback: Parse XML
    let xml_resp = client.get(download_info_url).send().await?.text().await?;
    let host = extract_tag(&xml_resp, "host").ok_or_else(|| anyhow!("host tag not found in: {}", xml_resp))?;
    let path = extract_tag(&xml_resp, "path").ok_or_else(|| anyhow!("path tag not found in: {}", xml_resp))?;
    let ts = extract_tag(&xml_resp, "ts").ok_or_else(|| anyhow!("ts tag not found in: {}", xml_resp))?;

    let path_clean = path.trim_start_matches('/');
    let sign_str = format!("{}{}{}", SECRET, path_clean, ts);
    let digest = md5::compute(sign_str.as_bytes());
    let sign = format!("{:x}", digest);

    Ok(format!("https://{}/get-mp3/{}/{}{}", host, sign, ts, path))
}

fn extract_tag(xml: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);
    let start = xml.find(&open)? + open.len();
    let end = xml.find(&close)?;
    if start <= end {
        Some(xml[start..end].to_string())
    } else {
        None
    }
}
