import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeKnowledgeTerm,
} from "../lib/dictionaries.ts";
import {
  AdaptedDocumentValidationError,
  sanitizeAdaptedDocumentInput,
} from "../lib/adapted-documents.ts";
import { decodeHtmlEntities } from "../lib/html-entities.ts";
import { createObsidianMarkdownExport } from "../lib/document-export.ts";
import { formatVideoDate } from "../lib/video-formatters.ts";
import {
  findKnowledgeConflict,
  KnowledgeValidationError,
  sanitizeKnowledgeEntityInput,
} from "../lib/knowledge-validation.ts";
import {
  extractYouTubeVideoId,
  formatYouTubeDuration,
  getVideoCardData,
  VideoServiceError,
} from "../lib/youtube.ts";

test("converte entidades HTML presentes na transcrição", () => {
  assert.equal(
    decodeHtmlEntities(
      "I&#39;ll use &quot;Codex&quot; &amp; test &#x27;again&#x27;.",
    ),
    "I'll use \"Codex\" & test 'again'.",
  );
  assert.equal(decodeHtmlEntities("Duplo: &amp;#39;"), "Duplo: '");
});

test("formata datas de vídeo no padrão curto", () => {
  assert.equal(formatVideoDate("2025-07-23T12:00:00Z"), "23 JUL 2025");
});
test("normaliza termos da Base de Conhecimento para comparação", () => {
  assert.equal(normalizeKnowledgeTerm("  Cláude   Code "), "claude code");
});

test("valida documentos técnicos antes do salvamento", () => {
  assert.deepEqual(
    sanitizeAdaptedDocumentInput({
      model: "anthropic/claude-sonnet-4.5",
      content: "# Documento técnico",
      prompt: "Organize a transcrição.",
    }),
    {
      model: "anthropic/claude-sonnet-4.5",
      content: "# Documento técnico",
      prompt: "Organize a transcrição.",
    },
  );
  assert.throws(
    () => sanitizeAdaptedDocumentInput({ model: "", content: "conteúdo" }),
    AdaptedDocumentValidationError,
  );
  assert.throws(
    () =>
      sanitizeAdaptedDocumentInput({
        model: "anthropic/claude-sonnet-4.5",
        content: "# Documento técnico",
      }),
    AdaptedDocumentValidationError,
  );
});
test("valida entidades e remove aliases repetidos", () => {
  const entity = sanitizeKnowledgeEntityInput({
    name: "Claude Code",
    aliases: ["Cloud Code", " cloud code ", "Claude Code"],
    tags: ["Agente", "agente"],
    details: { website: "https://claude.com" },
  });

  assert.deepEqual(entity.aliases, ["cloud code"]);
  assert.deepEqual(entity.tags, ["agente"]);
  assert.throws(
    () =>
      sanitizeKnowledgeEntityInput({
        name: "Claude Code",
        details: { website: "javascript:alert(1)" },
      }),
    KnowledgeValidationError,
  );
});

test("detecta conflitos entre nomes e aliases conhecidos", () => {
  const existing = {
    id: "tool-claude-code",
    dictionary: "ferramentas",
    name: "Claude Code",
    aliases: ["Cloud Code"],
    description: "",
    tags: [],
    details: {},
    createdAt: "",
    updatedAt: "",
  };

  assert.match(
    findKnowledgeConflict(
      "ferramentas",
      { name: "Cloud Code", aliases: [] },
      [existing],
    ),
    /alias/,
  );
  assert.match(
    findKnowledgeConflict(
      "ferramentas",
      { name: "Nova ferramenta", aliases: ["Claude Code"] },
      [existing],
    ),
    /associado/,
  );
});

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("aceita os dois formatos de URL solicitados", () => {
  assert.equal(
    extractYouTubeVideoId(
      "https://www.youtube.com/watch?v=474wZZHoWN4",
    ),
    "474wZZHoWN4",
  );
  assert.equal(
    extractYouTubeVideoId(
      "https://youtu.be/474wZZHoWN4?si=D2MPcHs9EOW8fV09",
    ),
    "474wZZHoWN4",
  );
});

test("rejeita URLs sem um identificador válido", () => {
  assert.throws(
    () => extractYouTubeVideoId("https://www.youtube.com/watch"),
    (error) =>
      error instanceof VideoServiceError &&
      error.code === "INVALID_VIDEO_ID" &&
      error.status === 400,
  );
  assert.throws(
    () => extractYouTubeVideoId("https://example.com/video"),
    (error) =>
      error instanceof VideoServiceError &&
      error.code === "UNSUPPORTED_URL",
  );
});

function createFetchMock({ hiddenSubscribers = false } = {}) {
  return async (input) => {
    const url = new URL(input.toString());

    if (url.pathname.endsWith("/videos")) {
      return Response.json({
        items: [
          {
            id: "474wZZHoWN4",
            snippet: {
              publishedAt: "2025-02-14T12:00:00Z",
              channelId: "channel-1",
              title: "Título de teste",
              description: "Descrição de teste",
              channelTitle: "Canal de teste",
              thumbnails: {
                high: { url: "https://i.ytimg.com/test.jpg" },
              },
            },
            statistics: { viewCount: "12500" },
            contentDetails: { duration: "PT12M34S" },
          },
        ],
      });
    }

    return Response.json({
      items: [
        {
          statistics: hiddenSubscribers
            ? { hiddenSubscriberCount: true }
            : {
                hiddenSubscriberCount: false,
                subscriberCount: "9800",
              },
        },
      ],
    });
  };
}

test("combina dados do vídeo, canal e transcrição", async () => {
  const result = await getVideoCardData("474wZZHoWN4", "test-key", {
    fetchImpl: createFetchMock(),
    transcriptProvider: async () => ({
      status: "available",
      text: "Transcrição de teste.",
      language: "Português",
      isAutoGenerated: false,
    }),
  });

  assert.equal(result.channelName, "Canal de teste");
  assert.equal(result.viewCount, "12500");
  assert.equal(result.subscriberCount, "9800");
  assert.equal(result.transcript.status, "available");
  assert.equal(result.duration, "12:34");
});

test("formata a duração ISO 8601 retornada pelo YouTube", () => {
  assert.equal(formatYouTubeDuration("PT12M34S"), "12:34");
  assert.equal(formatYouTubeDuration("PT1H2M3S"), "1:02:03");
  assert.equal(formatYouTubeDuration("invalid"), "Não informado");
});

test("preserva metadados quando a transcrição falha", async () => {
  const result = await getVideoCardData("474wZZHoWN4", "test-key", {
    fetchImpl: createFetchMock({ hiddenSubscribers: true }),
    transcriptProvider: async () => {
      throw new Error("captions disabled");
    },
  });

  assert.equal(result.title, "Título de teste");
  assert.equal(result.subscriberCount, null);
  assert.equal(result.subscriberCountHidden, true);
  assert.equal(result.transcript.status, "unavailable");
});

test("identifica vídeo privado, removido ou inexistente", async () => {
  await assert.rejects(
    getVideoCardData("474wZZHoWN4", "test-key", {
      fetchImpl: async () => Response.json({ items: [] }),
    }),
    (error) =>
      error instanceof VideoServiceError &&
      error.code === "VIDEO_NOT_FOUND" &&
      error.status === 404,
  );
});

test("diferencia cota excedida de chave inválida", async () => {
  const quotaFetch = async () =>
    Response.json(
      { error: { errors: [{ reason: "quotaExceeded" }] } },
      { status: 403 },
    );
  const invalidKeyFetch = async () =>
    Response.json(
      { error: { errors: [{ reason: "keyInvalid" }] } },
      { status: 400 },
    );

  await assert.rejects(
    getVideoCardData("474wZZHoWN4", "test-key", {
      fetchImpl: quotaFetch,
    }),
    (error) =>
      error instanceof VideoServiceError &&
      error.code === "QUOTA_EXCEEDED" &&
      error.status === 429,
  );
  await assert.rejects(
    getVideoCardData("474wZZHoWN4", "test-key", {
      fetchImpl: invalidKeyFetch,
    }),
    (error) =>
      error instanceof VideoServiceError &&
      error.code === "YOUTUBE_API_CONFIGURATION" &&
      error.status === 503,
  );
});

test("server-renderiza a página final", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Vídeo em Foco/);
  assert.match(html, /Tudo sobre um vídeo/);
  assert.match(html, /URL do vídeo/);
  assert.match(html, /Analisar vídeo/);
  assert.match(html, /Sua coleção de vídeos/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});



test("exporta documento para Obsidian com os metadados do vídeo", () => {
  const exported = createObsidianMarkdownExport(
    {
      videoId: "474wZZHoWN4",
      thumbnailUrl: "https://i.ytimg.com/test.jpg",
      channelName: "Canal de teste",
      title: "Título de teste",
      subscriberCount: "9800",
      subscriberCountHidden: false,
      viewCount: "12500",
      duration: "12:34",
      publishedAt: "2025-02-14T12:00:00Z",
      description: "Descrição de teste",
      transcript: {
        status: "available",
        text: "Transcrição de teste.",
        language: "Português",
        isAutoGenerated: false,
      },
    },
    "# Texto final",
  );

  assert.match(exported, /# Título de teste/);
  assert.match(exported, /!\[Thumbnail do vídeo\]\(https:\/\/i\.ytimg\.com\/test\.jpg\)/);
  assert.match(exported, /\*\*Canal:\*\* Canal de teste/);
  assert.match(exported, /\*\*Visualizações:\*\* 12\.500/);
  assert.match(exported, /\*\*Duração:\*\* 12:34/);
  assert.match(exported, /https:\/\/www\.youtube\.com\/watch\?v=474wZZHoWN4/);
  assert.match(exported, /# Texto final$/);
});
