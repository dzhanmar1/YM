use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricLine {
    pub time_ms: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncedLyrics {
    pub is_synced: bool,
    pub lines: Vec<LyricLine>,
    pub raw_text: String,
}

/// Parses an LRC formatted string into structured LyricLine elements
pub fn parse_lrc(lrc_content: &str) -> SyncedLyrics {
    let mut lines = Vec::new();
    let mut raw_lines = Vec::new();

    for line in lrc_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Check if line starts with timestamp: [mm:ss.xx] or [mm:ss]
        if let Some(bracket_end) = trimmed.find(']') {
            if trimmed.starts_with('[') {
                let tag = &trimmed[1..bracket_end];
                let text = trimmed[bracket_end + 1..].trim().to_string();

                if let Some(time_ms) = parse_timestamp(tag) {
                    if !text.is_empty() {
                        raw_lines.push(text.clone());
                    }
                    lines.push(LyricLine { time_ms, text });
                    continue;
                }
            }
        }

        // If not timestamped, treat as plain text line
        raw_lines.push(trimmed.to_string());
    }

    // Sort by timestamp if we have synced lines
    lines.sort_by_key(|l| l.time_ms);

    let is_synced = !lines.is_empty();
    let raw_text = if is_synced {
        lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n")
    } else {
        raw_lines.join("\n")
    };

    SyncedLyrics {
        is_synced,
        lines,
        raw_text,
    }
}

fn parse_timestamp(tag: &str) -> Option<u32> {
    // Expected format: mm:ss.xx or mm:ss:xx or mm:ss
    let parts: Vec<&str> = tag.split(':').collect();
    if parts.len() < 2 {
        return None;
    }

    let minutes: u32 = parts[0].parse().ok()?;
    let sec_part = parts[1];

    let (seconds, ms) = if let Some(dot_idx) = sec_part.find('.') {
        let sec: u32 = sec_part[..dot_idx].parse().ok()?;
        let fraction = &sec_part[dot_idx + 1..];
        let ms_val: u32 = match fraction.len() {
            1 => fraction.parse::<u32>().ok()? * 100,
            2 => fraction.parse::<u32>().ok()? * 10,
            3 => fraction.parse::<u32>().ok()?,
            _ => fraction[..3].parse::<u32>().ok()?,
        };
        (sec, ms_val)
    } else {
        let sec: u32 = sec_part.parse().ok()?;
        (sec, 0)
    };

    Some(minutes * 60_000 + seconds * 1_000 + ms)
}

/// Fetch lyrics for a track given its download info from Yandex
pub async fn fetch_and_parse_lyrics(client: &reqwest::Client, download_url: &str) -> Result<SyncedLyrics> {
    let resp = client.get(download_url).send().await?;
    let body = resp.text().await?;
    Ok(parse_lrc(&body))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lrc_lines() {
        let lrc = r#"
[ti:Test Song]
[ar:Test Artist]
[00:04.50]Line 1
[00:12.80]Line 2
[01:05.123]Line 3
"#;
        let parsed = parse_lrc(lrc);
        assert!(parsed.is_synced);
        assert_eq!(parsed.lines.len(), 3);
        assert_eq!(parsed.lines[0].time_ms, 4500);
        assert_eq!(parsed.lines[0].text, "Line 1");
        assert_eq!(parsed.lines[1].time_ms, 12800);
        assert_eq!(parsed.lines[2].time_ms, 65123);
    }
}
