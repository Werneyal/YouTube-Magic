const params = new URLSearchParams(window.location.search);
const token = params.get("extensionImport");
let delivered = false;

function deliverImport() {
  if (!token || delivered) return;

  chrome.runtime.sendMessage({ type: "CONSUME_IMPORT", token }, (response) => {
    if (chrome.runtime.lastError || !response?.ok || delivered) return;

    delivered = true;
    window.postMessage(
      {
        source: "video-em-foco-extension",
        type: "TRANSCRIPT_IMPORT",
        payload: response.payload,
      },
      window.location.origin,
    );

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("extensionImport");
    window.history.replaceState({}, "", currentUrl);
  });
}

window.addEventListener("video-em-foco-ready", deliverImport, { once: true });
window.setTimeout(deliverImport, 750);
