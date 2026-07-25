CREATE TABLE IF NOT EXISTS adapted_documents (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  model TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS adapted_documents_collection_video_created_idx
ON adapted_documents (collection_id, video_id, created_at DESC);
