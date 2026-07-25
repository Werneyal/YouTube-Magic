import type { TranscriptData, VideoCardData } from "./video-types";

const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

type FetchLike = typeof fetch;
type TranscriptProvider = (videoId: string) => Promise<TranscriptData>;

type ServiceDependencies = {
  fetchImpl?: FetchLike;
  transcriptProvider?: TranscriptProvider;
};

type YouTubeErrorPayload = {
  error?: {
    errors?: Array<{ reason?: string }>;
    message?: string;
  };
};

type VideoListPayload = YouTubeErrorPayload & {
  items?: Array<{
    id: string;
    snippet: {
      publishedAt: string;
      channelId: string;
      title: string;
      description: string;
      channelTitle: string;
      thumbnails: Record<string, { url: string } | undefined>;
    };
    statistics?: {
      viewCount?: string;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
};

type ChannelListPayload = YouTubeErrorPayload & {
  items?: Array<{
    statistics?: {
      subscriberCount?: string;
      hiddenSubscriberCount?: boolean;
    };
  }>;
};

export class VideoServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "VideoServiceError";
    this.code = code;
    this.status = status;
  }
}

export function extractYouTubeVideoId(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new VideoServiceError(
      "INVALID_URL",
      "Informe uma URL do YouTube.",
      400,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new VideoServiceError(
      "INVALID_URL",
      "A URL informada não é válida.",
      400,
    );
  }

  const host = parsedUrl.hostname.toLowerCase();
  let videoId = "";

  if (WATCH_HOSTS.has(host) && parsedUrl.pathname === "/watch") {
    videoId = parsedUrl.searchParams.get("v") ?? "";
  } else if (host === "youtu.be") {
    videoId = parsedUrl.pathname.split("/").filter(Boolean)[0] ?? "";
  } else {
    throw new VideoServiceError(
      "UNSUPPORTED_URL",
      "Use uma URL youtube.com/watch ou youtu.be.",
      400,
    );
  }

  if (!VIDEO_ID_PATTERN.test(videoId)) {
    throw new VideoServiceError(
      "INVALID_VIDEO_ID",
      "Não foi possível identificar um vídeo válido nessa URL.",
      400,
    );
  }

  return videoId;
}

export function formatYouTubeDuration(value?: string) {
  if (!value) return "Não informado";

  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return "Não informado";

  const [, hoursValue, minutesValue, secondsValue] = match;
  const hours = Number(hoursValue ?? 0);
  const minutes = Number(minutesValue ?? 0);
  const seconds = Number(secondsValue ?? 0);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds)
  ) {
    return "Não informado";
  }

  const formattedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${formattedSeconds}`;
  }

  return `${minutes}:${formattedSeconds}`;
}
function unavailableTranscript(reason?: string): TranscriptData {
  return {
    status: "unavailable",
    reason:
      reason ??
      "A transcrição não está disponível para este vídeo. As legendas podem estar desativadas ou restritas.",
  };
}

function getApiError(payload: YouTubeErrorPayload, fallbackStatus: number) {
  const reason = payload.error?.errors?.[0]?.reason;

  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return new VideoServiceError(
      "QUOTA_EXCEEDED",
      "A cota diária da API do YouTube foi atingida. Tente novamente mais tarde.",
      429,
    );
  }

  if (
    reason === "keyInvalid" ||
    reason === "accessNotConfigured" ||
    reason === "forbidden"
  ) {
    return new VideoServiceError(
      "YOUTUBE_API_CONFIGURATION",
      "A chave da API do YouTube não está válida ou ainda não foi habilitada.",
      503,
    );
  }

  return new VideoServiceError(
    "YOUTUBE_API_ERROR",
    "O YouTube não conseguiu responder à consulta agora. Tente novamente.",
    fallbackStatus >= 500 ? 502 : fallbackStatus,
  );
}

async function fetchJson<T>(
  url: URL,
  fetchImpl: FetchLike,
): Promise<{ response: Response; payload: T & YouTubeErrorPayload }> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new VideoServiceError(
      "YOUTUBE_UNAVAILABLE",
      "Não foi possível se conectar ao YouTube. Tente novamente.",
      502,
    );
  }

  const payload = (await response.json()) as T & YouTubeErrorPayload;
  if (!response.ok) throw getApiError(payload, response.status);

  return { response, payload };
}

export async function getVideoCardData(
  videoId: string,
  apiKey: string,
  dependencies: ServiceDependencies = {},
): Promise<VideoCardData> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const transcriptProvider =
    dependencies.transcriptProvider ??
    (async () => unavailableTranscript());

  const videoUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videoUrl.search = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoId,
    key: apiKey,
  }).toString();

  const { payload: videoPayload } = await fetchJson<VideoListPayload>(
    videoUrl,
    fetchImpl,
  );
  const video = videoPayload.items?.[0];

  if (!video) {
    throw new VideoServiceError(
      "VIDEO_NOT_FOUND",
      "Vídeo não encontrado. Ele pode ser privado, removido ou indisponível.",
      404,
    );
  }

  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.search = new URLSearchParams({
    part: "statistics",
    id: video.snippet.channelId,
    key: apiKey,
  }).toString();

  const transcriptPromise = transcriptProvider(videoId).catch(() =>
    unavailableTranscript(),
  );
  const [{ payload: channelPayload }, transcript] = await Promise.all([
    fetchJson<ChannelListPayload>(channelUrl, fetchImpl),
    transcriptPromise,
  ]);

  const channelStatistics = channelPayload.items?.[0]?.statistics;
  const thumbnails = video.snippet.thumbnails;
  const thumbnailUrl =
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url;

  if (!thumbnailUrl) {
    throw new VideoServiceError(
      "VIDEO_DATA_INCOMPLETE",
      "O YouTube retornou dados incompletos para este vídeo.",
      502,
    );
  }

  return {
    videoId,
    thumbnailUrl,
    channelName: video.snippet.channelTitle,
    title: video.snippet.title,
    subscriberCount: channelStatistics?.subscriberCount ?? null,
    subscriberCountHidden:
      channelStatistics?.hiddenSubscriberCount ??
      !channelStatistics?.subscriberCount,
    viewCount: video.statistics?.viewCount ?? "0",
    duration: formatYouTubeDuration(video.contentDetails?.duration),
    publishedAt: video.snippet.publishedAt,
    description: video.snippet.description,
    transcript,
  };
}
