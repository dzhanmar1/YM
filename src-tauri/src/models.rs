use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthStatus {
    pub authenticated: bool,
    pub uid: Option<u64>,
    pub login: Option<String>,
    pub name: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackItemDto {
    pub id: String,
    pub title: String,
    pub duration_ms: u32,
    pub cover_uri: Option<String>,
    pub artists: Vec<String>,
    pub album_title: Option<String>,
    pub album_id: Option<String>,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtistDto {
    pub id: String,
    pub name: String,
    pub cover_uri: Option<String>,
    pub genres: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlbumDto {
    pub id: String,
    pub title: String,
    pub year: Option<u32>,
    pub cover_uri: Option<String>,
    pub artist_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistDto {
    pub kind: u64,
    pub title: String,
    pub track_count: u32,
    pub cover_uri: Option<String>,
    pub owner_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotorStationDto {
    pub station_id: String,
    pub batch_id: String,
    pub tracks: Vec<TrackItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultsDto {
    pub tracks: Vec<TrackItemDto>,
    pub artists: Vec<ArtistDto>,
    pub albums: Vec<AlbumDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatsDto {
    pub count: u64,
    pub total_bytes: u64,
    pub formatted_size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalPlaylistDto {
    pub kind: u64,
    pub owner_login: String,
    pub title: String,
    pub description: Option<String>,
    pub cover_uri: Option<String>,
    pub track_count: u32,
    pub header: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartTrackDto {
    pub track: TrackItemDto,
    pub position: u32,
    pub progress: Option<String>,
    pub shift: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LandingDataDto {
    pub personal_playlists: Vec<PersonalPlaylistDto>,
    pub chart_tracks: Vec<ChartTrackDto>,
    pub new_releases: Vec<AlbumDto>,
}
