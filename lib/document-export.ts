import type { VideoCardData } from "./video-types";

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatPublicationDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  }).format(new Date(value));
}

function formatViewCount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("pt-BR").format(parsed)
    : value;
}

export function createObsidianMarkdownExport(
  video: VideoCardData,
  content: string,
) {
  const title = oneLine(video.title);
  const channel = oneLine(video.channelName);
  const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  return `# ${title}

![Thumbnail do vídeo](${video.thumbnailUrl})

- **Canal:** ${channel}
- **Publicado em:** ${formatPublicationDate(video.publishedAt)}
- **Visualizações:** ${formatViewCount(video.viewCount)}
- **Duração:** ${video.duration ?? "Não informado"}
- **Vídeo:** [Assistir no YouTube](${videoUrl})

---

${content.trim()}`;
}
