export const savedVideosSchema = `
  CREATE TABLE IF NOT EXISTS saved_videos (
    collection_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    video_data TEXT NOT NULL,
    saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, video_id)
  )
`;

export const adaptedDocumentsSchema = `
  CREATE TABLE IF NOT EXISTS adapted_documents (
    id TEXT PRIMARY KEY,
    collection_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    model TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    prompt_template TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export const adaptedDocumentsIndexSchema = `
  CREATE INDEX IF NOT EXISTS adapted_documents_collection_video_created_idx
  ON adapted_documents (collection_id, video_id, created_at DESC)
`;

export const knowledgeEntitiesSchema = `
  CREATE TABLE IF NOT EXISTS knowledge_entities (
    id TEXT PRIMARY KEY,
    dictionary TEXT NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    aliases_json TEXT NOT NULL DEFAULT '[]',
    description TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

export const knowledgeMetadataSchema = `
  CREATE TABLE IF NOT EXISTS knowledge_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`;

export const knowledgeDictionaryIndexSchema = `
  CREATE INDEX IF NOT EXISTS knowledge_entities_dictionary_idx
  ON knowledge_entities (dictionary, normalized_name)
`;
