const IMPORT_TTL_MS = 10 * 60 * 1000;
const IMPORT_PREFIX = "video-em-foco-import:";

function createImportKey(token) {
  return `${IMPORT_PREFIX}${token}`;
}

function isImportPayload(value) {
  return (
    value &&
    typeof value.url === "string" &&
    typeof value.transcript === "string" &&
    value.url.length <= 2048 &&
    value.transcript.length > 0 &&
    value.transcript.length <= 500000
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "STORE_IMPORT") {
    if (!isImportPayload(message.payload)) {
      sendResponse({ ok: false, error: "A transcrição recebida não é válida." });
      return;
    }

    const token = crypto.randomUUID();
    const key = createImportKey(token);
    const payload = {
      ...message.payload,
      createdAt: Date.now(),
    };

    chrome.storage.session.set({ [key]: payload }).then(
      () => sendResponse({ ok: true, token }),
      () => sendResponse({ ok: false, error: "Não foi possível preparar a importação." }),
    );
    return true;
  }

  if (message?.type === "CONSUME_IMPORT" && typeof message.token === "string") {
    const key = createImportKey(message.token);

    chrome.storage.session.get(key).then(
      (items) => {
        const payload = items[key];
        void chrome.storage.session.remove(key);

        if (
          !isImportPayload(payload) ||
          Date.now() - payload.createdAt > IMPORT_TTL_MS
        ) {
          sendResponse({ ok: false, error: "Esta importação expirou. Tente novamente." });
          return;
        }

        sendResponse({ ok: true, payload });
      },
      () => sendResponse({ ok: false, error: "Não foi possível ler a importação." }),
    );
    return true;
  }
});
