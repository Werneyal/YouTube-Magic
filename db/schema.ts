export const savedVideosSchema = `
  CREATE TABLE IF NOT EXISTS saved_videos (
    collection_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_data TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, video_id)
  )
`;
