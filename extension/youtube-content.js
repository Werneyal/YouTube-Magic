const TRANSCRIPT_BUTTON_PATTERN = /\b(mostrar|show)\s+(a\s+)?transcri(?:ção|ption)/i;
const SEGMENT_SELECTORS = [
  "ytd-transcript-segment-renderer .segment-text",
  "ytd-transcript-segment-renderer [class*='segment-text']",
  "ytd-transcript-segment-renderer yt-formatted-string",
  "ytd-transcript-segment-renderer",
];

function normaliseText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractSegments() {
  for (const selector of SEGMENT_SELECTORS) {
    const segments = Array.from(document.querySelectorAll(selector))
      .map((element) => normaliseText(element.textContent ?? ""))
      .map((text) => text.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s*/, ""))
      .filter(Boolean);

    if (segments.length > 0) {
      return Array.from(new Set(segments));
    }
  }

  return [];
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
