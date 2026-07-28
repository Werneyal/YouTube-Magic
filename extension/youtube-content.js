const TRANSCRIPT_BUTTON_PATTERN = /\b(mostrar|show)\s+(a\s+)?transcri(?:ção|ption)/i;
const TIMESTAMP_PREFIX_PATTERN = /^(?:(?:\d{1,2}:)?\d{1,2}:\d{2})\s*/;
const SPOKEN_TIMESTAMP_PATTERN = /^\d+\s+(?:segundo|segundos|minuto|minutos|hora|horas)(?:\s+e\s+\d+\s+(?:segundo|segundos|minuto|minutos|hora|horas))?\s*/i;
const SEGMENT_SELECTORS = [
  "ytd-transcript-segment-renderer .segment-text",
  "ytd-transcript-segment-renderer [class*='segment-text']",
  "ytd-transcript-segment-renderer yt-formatted-string",
  "ytd-transcript-segment-renderer",
];
const TRANSCRIPT_PANEL_SELECTORS = [
  "ytd-transcript-renderer",
  "ytd-transcript-search-panel-renderer",
  "ytd-engagement-panel-section-list-renderer",
];

function normaliseText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function removeTimestamp(value) {
  return normaliseText(value)
    .replace(TIMESTAMP_PREFIX_PATTERN, "")
    .replace(SPOKEN_TIMESTAMP_PATTERN, "")
    .trim();
}

function uniqueSegments(segments) {
  return Array.from(new Set(segments.filter(Boolean)));
}

function extractLegacySegments() {
  for (const selector of SEGMENT_SELECTORS) {
    const segments = Array.from(document.querySelectorAll(selector))
      .map((element) => removeTimestamp(element.textContent ?? ""));

    if (segments.length > 0) return uniqueSegments(segments);
  }

  return [];
}

function getTranscriptPanels() {
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, [role='heading']"),
  ).filter((element) => normaliseText(element.textContent ?? "").toLowerCase() === "transcrição");

  const panels = headings
    .map((heading) => heading.closest(TRANSCRIPT_PANEL_SELECTORS.join(", ")))
    .filter(Boolean);

  return Array.from(new Set(panels));
}

function extractModernSegments() {
  for (const panel of getTranscriptPanels()) {
    const segments = Array.from(panel.querySelectorAll("button, [role='button']"))
      .filter((element) =>
        TIMESTAMP_PREFIX_PATTERN.test(normaliseText(element.textContent ?? "")),
      )
      .map((element) => {
        const transcriptText = normaliseText(
          element.querySelector("[role='text']")?.textContent ?? "",
        );

        return transcriptText || removeTimestamp(element.textContent ?? "");
      });

    if (segments.length > 0) return uniqueSegments(segments);
  }

  // O layout mais recente do YouTube pode manter a aba "Transcrição" em um
  // painel separado dos botões que contêm os trechos. Nesse caso, procuramos
  // os botões com timestamp na página inteira e ignoramos controles curtos,
  // como a duração do player.
  return uniqueSegments(
    Array.from(document.querySelectorAll("button, [role='button']"))
      .filter((element) =>
        TIMESTAMP_PREFIX_PATTERN.test(normaliseText(element.textContent ?? "")),
      )
      .map((element) => removeTimestamp(element.textContent ?? ""))
      .filter((segment) => segment.length >= 20),
  );
}

function extractSegments() {
  const legacySegments = extractLegacySegments();
  return legacySegments.length > 0 ? legacySegments : extractModernSegments();
}

function findTranscriptButton() {
  const candidates = document.querySelectorAll(
    "button, [role='button'], ytd-menu-service-item-renderer, tp-yt-paper-item",
  );

  return Array.from(candidates).find((element) =>
    TRANSCRIPT_BUTTON_PATTERN.test(normaliseText(element.textContent ?? "")),
  );
}

function waitForTranscript(timeoutMs = 7000) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const segments = extractSegments();
      if (segments.length > 0 || Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        resolve(segments);
      }
    }, 250);
  });
}

async function extractTranscript() {
  let segments = extractSegments();

  if (segments.length === 0) {
    const button = findTranscriptButton();
    if (button instanceof HTMLElement) {
      button.click();
      segments = await waitForTranscript();
    }
  }

  if (segments.length === 0) {
    return {
      ok: false,
      error:
        "Não encontrei a transcrição nesta página. No YouTube, abra “Mostrar transcrição” e tente de novo.",
    };
  }

  return {
    ok: true,
    payload: {
      url: window.location.href,
      transcript: segments.join("\n"),
      language: "Importada da página do YouTube",
    },
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_TRANSCRIPT") return;

  extractTranscript().then(
    (result) => sendResponse(result),
    () =>
      sendResponse({
        ok: false,
        error: "Não foi possível ler a transcrição desta página.",
      }),
  );
  return true;
});
