/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { savedVideosSchema } from "../db/schema";

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

type SavedVideoRow = {
  video_data: string;
  saved_at: string;
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
