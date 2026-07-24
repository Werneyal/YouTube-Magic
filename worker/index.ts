/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  knowledgeDictionaryIndexSchema,
  knowledgeEntitiesSchema,
  knowledgeMetadataSchema,
  savedVideosSchema,
} from "../db/schema";
import { dictionarySeeds } from "../lib/dictionary-seeds";
import {
  dictionariesConfig,
  getDictionaryConfig,
  isDictionaryKey,
  normalizeKnowledgeTerm,
  type DictionaryKey,
  type DictionarySummary,
  type KnowledgeEntity,
  type KnowledgeEntityInput,
} from "../lib/dictionaries";
import {
  findKnowledgeConflict,
  KnowledgeValidationError,
  sanitizeKnowledgeEntityInput,
} from "../lib/knowledge-validation";

interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const COLLECTION_COOKIE = "video_em_foco_collection";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const KNOWLEDGE_SEED_VERSION = "knowledge_seed_frameworks_2026_07_24";

type SavedVideoRow = {
  video_data: string;
  saved_at: string;
};

type KnowledgeEntityRow = {
  id: string;
  dictionary: DictionaryKey;
  name: string;
  aliases_json: string;
  description: string;
  tags_json: string;
  details_json: string;
  created_at: string;
  updated_at: string;
};

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function collectionIdFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${COLLECTION_COOKIE}=([^;]+)`));
  return match?.[1] ?? crypto.randomUUID();
}

function collectionCookie(request: Request, collectionId: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COLLECTION_COOKIE}=${collectionId}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

async function initializeCollectionDatabase(db: D1Database) {
  await db.prepare(savedVideosSchema).run();
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function knowledgeEntityFromRow(row: KnowledgeEntityRow): KnowledgeEntity {
  let details = {};
  try {
    const parsed = JSON.parse(row.details_json);
    if (parsed && typeof parsed === "object") details = parsed;
  } catch {
    details = {};
  }

  return {
    id: row.id,
    dictionary: row.dictionary,
    name: row.name,
    aliases: parseJsonList(row.aliases_json),
    description: row.description,
    tags: parseJsonList(row.tags_json),
    details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function initializeKnowledgeDatabase(db: D1Database) {
  await db.batch([
    db.prepare(knowledgeEntitiesSchema),
    db.prepare(knowledgeMetadataSchema),
    db.prepare(knowledgeDictionaryIndexSchema),
  ]);

  const seedState = await db
    .prepare("SELECT value FROM knowledge_metadata WHERE key = ?")
    .bind(KNOWLEDGE_SEED_VERSION)
    .first<{ value: string }>();

  if (seedState) return;

  const inserts = dictionarySeeds.map((entity) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO knowledge_entities
        (id, dictionary, name, normalized_name, aliases_json, description, tags_json, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entity.id,
        entity.dictionary,
        entity.name,
        normalizeKnowledgeTerm(entity.name),
        JSON.stringify(entity.aliases),
        entity.description,
        JSON.stringify(entity.tags),
        JSON.stringify(entity.details),
      ),
  );

  await db.batch([
    ...inserts,
    db
      .prepare(
        "INSERT OR REPLACE INTO knowledge_metadata (key, value) VALUES (?, ?)",
      )
      .bind(KNOWLEDGE_SEED_VERSION, "1"),
  ]);
}

async function listKnowledgeEntities(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT id, dictionary, name, aliases_json, description, tags_json,
      details_json, created_at, updated_at
      FROM knowledge_entities
      ORDER BY normalized_name`,
    )
    .all<KnowledgeEntityRow>();
  return results.map(knowledgeEntityFromRow);
}

async function writeKnowledgeEntity(
  db: D1Database,
  dictionary: DictionaryKey,
  input: KnowledgeEntityInput,
  id?: string,
) {
  const entities = await listKnowledgeEntities(db);
  const conflict = findKnowledgeConflict(dictionary, input, entities, id);
  if (conflict) throw new KnowledgeValidationError(conflict, 409);

  const entityId = id ?? crypto.randomUUID();
  const existing = id ? entities.find((entity) => entity.id === id) : undefined;
  if (id && (!existing || existing.dictionary !== dictionary)) {
    throw new KnowledgeValidationError("Entidade não encontrada.", 404);
  }

  if (existing) {
    await db
      .prepare(
        `UPDATE knowledge_entities
        SET name = ?, normalized_name = ?, aliases_json = ?, description = ?,
            tags_json = ?, details_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND dictionary = ?`,
      )
      .bind(
        input.name,
        normalizeKnowledgeTerm(input.name),
        JSON.stringify(input.aliases ?? []),
        input.description ?? "",
        JSON.stringify(input.tags ?? []),
        JSON.stringify(input.details ?? {}),
        entityId,
        dictionary,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO knowledge_entities
        (id, dictionary, name, normalized_name, aliases_json, description, tags_json, details_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entityId,
        dictionary,
        input.name,
        normalizeKnowledgeTerm(input.name),
        JSON.stringify(input.aliases ?? []),
        input.description ?? "",
        JSON.stringify(input.tags ?? []),
        JSON.stringify(input.details ?? {}),
      )
      .run();
  }

  const row = await db
    .prepare(
      `SELECT id, dictionary, name, aliases_json, description, tags_json,
      details_json, created_at, updated_at
      FROM knowledge_entities WHERE id = ?`,
    )
    .bind(entityId)
    .first<KnowledgeEntityRow>();

  if (!row) {
    throw new KnowledgeValidationError(
      "Não foi possível recuperar a entidade salva.",
      500,
    );
  }
  return knowledgeEntityFromRow(row);
}

async function handleDictionariesRequest(request: Request, db: D1Database) {
  await initializeKnowledgeDatabase(db);
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const dictionaryValue = parts[2];
  const entityId = parts[3];

  try {
    if (!dictionaryValue) {
      if (request.method !== "GET") {
        return jsonResponse(
          { error: { message: "Método não permitido." } },
          { status: 405 },
        );
      }

      const entities = await listKnowledgeEntities(db);
      const dictionaries: DictionarySummary[] = dictionariesConfig.map(
        (config) => {
          const dictionaryEntities = entities.filter(
            (entity) => entity.dictionary === config.key,
          );
          return {
            ...config,
            entityCount: dictionaryEntities.length,
            aliasCount: dictionaryEntities.reduce(
              (total, entity) => total + entity.aliases.length,
              0,
            ),
          };
        },
      );
      return jsonResponse({ dictionaries });
    }

    if (!isDictionaryKey(dictionaryValue)) {
      return jsonResponse(
        { error: { message: "Dicionário não encontrado." } },
        { status: 404 },
      );
    }

    if (request.method === "GET" && !entityId) {
      const entities = (await listKnowledgeEntities(db)).filter(
        (entity) => entity.dictionary === dictionaryValue,
      );
      return jsonResponse({
        dictionary: getDictionaryConfig(dictionaryValue),
        entities,
      });
    }

    if (request.method === "POST" && !entityId) {
      const input = sanitizeKnowledgeEntityInput(await request.json());
      const entity = await writeKnowledgeEntity(db, dictionaryValue, input);
      return jsonResponse({ entity }, { status: 201 });
    }

    if (request.method === "PATCH" && entityId) {
      const input = sanitizeKnowledgeEntityInput(await request.json());
      const entity = await writeKnowledgeEntity(
        db,
        dictionaryValue,
        input,
        entityId,
      );
      return jsonResponse({ entity });
    }

    if (request.method === "DELETE" && entityId) {
      const result = await db
        .prepare(
          "DELETE FROM knowledge_entities WHERE id = ? AND dictionary = ?",
        )
        .bind(entityId, dictionaryValue)
        .run();
      if (!result.meta.changes) {
        return jsonResponse(
          { error: { message: "Entidade não encontrada." } },
          { status: 404 },
        );
      }
      return jsonResponse({ ok: true });
    }

    return jsonResponse(
      { error: { message: "Método não permitido." } },
      { status: 405 },
    );
  } catch (error) {
    if (error instanceof KnowledgeValidationError) {
      return jsonResponse(
        { error: { message: error.message } },
        { status: error.status },
      );
    }
    return jsonResponse(
      { error: { message: "Não foi possível atualizar a Base de Conhecimento." } },
      { status: 500 },
    );
  }
}

async function saveVideo(db: D1Database, collectionId: string, video: unknown) {
  if (
    !video ||
    typeof video !== "object" ||
    !("videoId" in video) ||
    typeof video.videoId !== "string"
  ) {
    return;
  }

  await initializeCollectionDatabase(db);
  await db
    .prepare(
      "INSERT OR REPLACE INTO saved_videos (collection_id, video_id, video_data, saved_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    )
    .bind(collectionId, video.videoId, JSON.stringify(video))
    .run();
}

async function handleCollectionRequest(request: Request, db: D1Database) {
  const collectionId = collectionIdFromRequest(request);
  await initializeCollectionDatabase(db);

  if (request.method === "GET") {
    const { results } = await db
      .prepare(
        "SELECT video_data, saved_at FROM saved_videos WHERE collection_id = ? ORDER BY saved_at DESC",
      )
      .bind(collectionId)
      .all<SavedVideoRow>();
    const videos = results.flatMap((row) => {
      try {
        return [{ ...JSON.parse(row.video_data), savedAt: row.saved_at }];
      } catch {
        return [];
      }
    });
    return jsonResponse(
      { videos },
      { headers: { "set-cookie": collectionCookie(request, collectionId) } },
    );
  }

  if (request.method === "DELETE") {
    const videoId = new URL(request.url).pathname.split("/").pop();
    if (!videoId) {
      return jsonResponse({ error: { message: "Vídeo não informado." } }, { status: 400 });
    }

    await db
      .prepare("DELETE FROM saved_videos WHERE collection_id = ? AND video_id = ?")
      .bind(collectionId, videoId)
      .run();
    return jsonResponse(
      { ok: true },
      { headers: { "set-cookie": collectionCookie(request, collectionId) } },
    );
  }

  return jsonResponse(
    { error: { message: "Método não permitido." } },
    { status: 405 },
  );
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/collection" || url.pathname.startsWith("/api/collection/")) {
      if (!env.DB) {
        return jsonResponse(
          { error: { message: "A coleção ainda não está disponível neste ambiente." } },
          { status: 503 },
        );
      }

      return handleCollectionRequest(request, env.DB);
    }

    if (url.pathname === "/api/dictionaries" || url.pathname.startsWith("/api/dictionaries/")) {
      if (!env.DB) {
        return jsonResponse(
          { error: { message: "A Base de Conhecimento ainda não está disponível neste ambiente." } },
          { status: 503 },
        );
      }

      return handleDictionariesRequest(request, env.DB);
    }

    const response = await handler.fetch(request, env, ctx);

    if (url.pathname !== "/api/video" || request.method !== "POST" || !response.ok || !env.DB) {
      return response;
    }

    const collectionId = collectionIdFromRequest(request);
    try {
      await saveVideo(env.DB, collectionId, await response.clone().json());
      const headers = new Headers(response.headers);
      headers.append("set-cookie", collectionCookie(request, collectionId));
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return response;
    }
  },
};

export default worker;
