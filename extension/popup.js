const DEFAULT_APP_URL = "https://video-em-foco.werneyal.chatgpt.site/";
const PUBLISHED_APP_ORIGIN = "https://video-em-foco.werneyal.chatgpt.site";
const LOCAL_APP_HOSTS = ["localhost", "127.0.0.1"];
const appUrlInput = document.querySelector("#app-url");
const importButton = document.querySelector("#import-button");
const status = document.querySelector("#status");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function normaliseAppUrl(value) {
  const url = new URL(value);
  const isLocalApp =
    url.protocol === "http:" &&
    LOCAL_APP_HOSTS.includes(url.hostname) &&
    Boolean(url.port);
  const isPublishedApp = url.origin === PUBLISHED_APP_ORIGIN;

  if (!isLocalApp && !isPublishedApp) {
    throw new Error(
      "Use https://video-em-foco.werneyal.chatgpt.site/ ou um endereço local, como http://localhost:3000/.",
    );
  }

  return url;
}

async function loadSettings() {
  const settings = await chrome.storage.local.get("appUrl");
  appUrlInput.value = settings.appUrl ?? DEFAULT_APP_URL;
}

async function requestTranscript(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_TRANSCRIPT",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("Receiving end does not exist")) {
      throw error;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["youtube-content.js"],
    });

    return chrome.tabs.sendMessage(tabId, {
      type: "EXTRACT_TRANSCRIPT",
    });
  }
}
async function importTranscript() {
  let appUrl;

  try {
    appUrl = normaliseAppUrl(appUrlInput.value.trim());
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Endereço do app inválido.", true);
    return;
  }

  await chrome.storage.local.set({ appUrl: appUrl.toString() });
  importButton.disabled = true;
  setStatus("Lendo a transcrição desta aba…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id || !tab.url?.includes("youtube.com/")) {
      throw new Error("Abra uma página de vídeo do YouTube e tente novamente.");
    }

    const extracted = await requestTranscript(tab.id);
    if (!extracted?.ok) {
      throw new Error(extracted?.error ?? "Não foi possível ler a transcrição.");
    }

    const stored = await chrome.runtime.sendMessage({
      type: "STORE_IMPORT",
      payload: extracted.payload,
    });
    if (!stored?.ok) {
      throw new Error(stored?.error ?? "Não foi possível preparar a importação.");
    }

    appUrl.searchParams.set("extensionImport", stored.token);
    await chrome.tabs.create({ url: appUrl.toString() });
    setStatus("Pronto: o Vídeo em Foco foi aberto com a transcrição.");
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir a importação.",
      true,
    );
  } finally {
    importButton.disabled = false;
  }
}

void loadSettings();
importButton.addEventListener("click", () => void importTranscript());


