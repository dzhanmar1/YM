use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::Mutex;

static DB_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

pub fn init_db(data_dir: &str) -> Result<()> {
    let dir = PathBuf::from(data_dir);
    std::fs::create_dir_all(&dir)?;
    let db_path = dir.join("ym_desktop.db");

    let conn = Connection::open(&db_path)?;

    // Create auth table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS auth (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create tracks cache index
    conn.execute(
        "CREATE TABLE IF NOT EXISTS track_cache (
            track_id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    let mut guard = DB_PATH.lock().unwrap();
    *guard = Some(db_path);

    Ok(())
}

fn get_connection() -> Result<Connection> {
    let guard = DB_PATH.lock().unwrap();
    let path = guard
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Database not initialized"))?;
    Ok(Connection::open(path)?)
}

pub fn save_token(token: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR REPLACE INTO auth (key, value) VALUES ('token', ?1)",
        params![token],
    )?;
    Ok(())
}

pub fn load_token() -> Result<Option<String>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare("SELECT value FROM auth WHERE key = 'token'")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn clear_token() -> Result<()> {
    let conn = get_connection()?;
    conn.execute("DELETE FROM auth WHERE key = 'token'", [])?;
    Ok(())
}

#[allow(dead_code)]
pub fn get_setting(key: &str) -> Result<Option<String>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

#[allow(dead_code)]
pub fn set_setting(key: &str, value: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![key, value],
    )?;
    Ok(())
}

pub fn record_cached_track(track_id: &str, file_path: &str, file_size: u64) -> Result<()> {
    let conn = get_connection()?;
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT OR REPLACE INTO track_cache (track_id, file_path, file_size, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![track_id, file_path, file_size as i64, now],
    )?;
    Ok(())
}

#[allow(dead_code)]
pub fn get_cached_track_path(track_id: &str) -> Result<Option<String>> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare("SELECT file_path FROM track_cache WHERE track_id = ?1")?;
    let mut rows = stmt.query(params![track_id])?;
    if let Some(row) = rows.next()? {
        let path: String = row.get(0)?;
        if std::path::Path::new(&path).exists() {
            return Ok(Some(path));
        } else {
            // File was deleted from disk, remove stale record
            let _ = conn.execute("DELETE FROM track_cache WHERE track_id = ?1", params![track_id]);
        }
    }
    Ok(None)
}

pub fn get_cache_stats() -> Result<(u64, u64)> {
    let conn = get_connection()?;
    let mut stmt = conn.prepare("SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM track_cache")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        let count: i64 = row.get(0)?;
        let total_size: i64 = row.get(1)?;
        Ok((count as u64, total_size as u64))
    } else {
        Ok((0, 0))
    }
}

pub fn clear_track_cache() -> Result<()> {
    let conn = get_connection()?;
    // Get all file paths and delete them
    let mut stmt = conn.prepare("SELECT file_path FROM track_cache")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    for path_res in rows {
        if let Ok(path) = path_res {
            let _ = std::fs::remove_file(path);
        }
    }
    conn.execute("DELETE FROM track_cache", [])?;
    Ok(())
}
