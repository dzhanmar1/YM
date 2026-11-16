use anyhow::{anyhow, Result};
use parking_lot::RwLock;
use std::sync::Arc;
use yandex_music::YandexMusicClient;

use crate::db;
use crate::models::AuthStatus;

pub static CURRENT_CLIENT: RwLock<Option<Arc<YandexMusicClient>>> = RwLock::new(None);
pub static CURRENT_TOKEN: RwLock<Option<String>> = RwLock::new(None);

pub fn get_client() -> Result<Arc<YandexMusicClient>> {
    let guard = CURRENT_CLIENT.read();
    guard
        .clone()
        .ok_or_else(|| anyhow!("Клиент Яндекс Музыки не авторизован"))
}

pub fn get_token() -> Option<String> {
    CURRENT_TOKEN.read().clone()
}

pub fn sanitize_token(raw: &str) -> String {
    let trimmed = raw.trim();
    if let Some(pos) = trimmed.find("access_token=") {
        let after = &trimmed[pos + "access_token=".len()..];
        let token_part = after.split(|c| c == '&' || c == '#' || c == ' ' || c == '\n').next().unwrap_or(after);
        return token_part.trim().to_string();
    }
    trimmed.to_string()
}

pub async fn login_with_token(token: &str) -> Result<AuthStatus> {
    let clean_token_str = sanitize_token(token);
    let clean_token = clean_token_str.as_str();
    if clean_token.is_empty() {
        return Err(anyhow!("Токен не может быть пустым"));
    }

    // Initialize yandex-music client
    let client = YandexMusicClient::builder(clean_token)
        .build()
        .map_err(|e| anyhow!("Ошибка создания клиента: {}", e))?;

    // Verify token by requesting account status
    let status_res = client.get_account_status().await;
    match status_res {
        Ok(status) => {
            let uid = status.account.uid;
            let login = status.account.login;
            let name = status.account.first_name;

            // Save token in DB
            db::save_token(clean_token)?;

            // Store in memory
            let arc_client = Arc::new(client);
            *CURRENT_CLIENT.write() = Some(arc_client);
            *CURRENT_TOKEN.write() = Some(clean_token.to_string());

            Ok(AuthStatus {
                authenticated: true,
                uid,
                login,
                name,
                token: Some(clean_token.to_string()),
            })
        }
        Err(e) => Err(anyhow!("Неверный токен или ошибка авторизации: {}", e)),
    }
}

pub async fn check_auth() -> Result<AuthStatus> {
    if let Some(token) = db::load_token()? {
        match login_with_token(&token).await {
            Ok(status) => Ok(status),
            Err(e) => {
                let err_str = e.to_string();
                let is_unauthorized = err_str.contains("401")
                    || err_str.contains("403")
                    || err_str.contains("Unauthorized")
                    || err_str.contains("Неверный токен");

                if is_unauthorized {
                    let _ = db::clear_token();
                    Ok(AuthStatus {
                        authenticated: false,
                        uid: None,
                        login: None,
                        name: None,
                        token: None,
                    })
                } else {
                    // Network glitch or timeout: do not wipe user credentials
                    *CURRENT_TOKEN.write() = Some(token.clone());
                    if let Ok(client) = YandexMusicClient::builder(&token).build() {
                        *CURRENT_CLIENT.write() = Some(Arc::new(client));
                    }
                    Ok(AuthStatus {
                        authenticated: true,
                        uid: None,
                        login: None,
                        name: None,
                        token: Some(token),
                    })
                }
            }
        }
    } else {
        Ok(AuthStatus {
            authenticated: false,
            uid: None,
            login: None,
            name: None,
            token: None,
        })
    }
}

pub fn logout() -> Result<()> {
    db::clear_token()?;
    *CURRENT_CLIENT.write() = None;
    *CURRENT_TOKEN.write() = None;
    Ok(())
}

pub async fn extract_token_from_cookies(cookies: &str) -> Result<String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()?;

    let url = "https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d";

    let res = client
        .get(url)
        .header("Cookie", cookies.trim())
        .send()
        .await?;

    if res.status().is_redirection() {
        if let Some(location) = res.headers().get("location") {
            let loc_str = location.to_str().unwrap_or("");
            if let Some(hash) = loc_str.split('#').nth(1) {
                for param in hash.split('&') {
                    if param.starts_with("access_token=") {
                        let token = param.replace("access_token=", "");
                        return Ok(token);
                    }
                }
            }
            return Err(anyhow!("Редирект выполнен, но токен не найден в URL: {}", loc_str));
        }
    }

    Err(anyhow!("Сервер не вернул редирект с токеном. Убедитесь, что переданы актуальные куки (включая Session_id)."))
}
