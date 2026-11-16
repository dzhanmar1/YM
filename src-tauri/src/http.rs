use anyhow::Result;
use std::sync::OnceLock;
use std::time::Duration;

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
static STREAM_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

/// Global client for YM API requests (rotor, library, lyrics, search)
pub fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(8))
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("Failed to build global HTTP client")
    })
}

/// Dedicated client for audio stream downloading / chunk proxying
pub fn get_stream_client() -> &'static reqwest::Client {
    STREAM_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(90))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("Failed to build global stream client")
    })
}

/// Execute an async operation with exponential backoff retries.
pub async fn send_with_retry<F, Fut, T>(mut f: F, max_attempts: usize) -> Result<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T>>,
{
    let mut attempt = 0;
    loop {
        attempt += 1;
        match f().await {
            Ok(val) => return Ok(val),
            Err(_e) if attempt < max_attempts => {
                let delay_ms = 350 * (1 << (attempt - 1)); // 350ms, 700ms, 1400ms
                tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            }
            Err(e) => return Err(e),
        }
    }
}
