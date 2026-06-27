/**
 * background.js — Manifest V3 service worker.
 *
 * IMPORTANT: service workers are event-driven and can be killed/restarted
 * by Chrome at any time. Never rely on in-memory variables surviving
 * between events — everything that matters is read from / written to
 * chrome.storage via storage.js.
 */

importScripts("storage.js");

const TARGET_URLS = {
  claude: "https://claude.ai/new",
  chatgpt: "https://chatgpt.com/",
  gemini: "https://gemini.google.com/app",
  grok: "https://grok.com/",
  perplexity: "https://www.perplexity.ai/",
};

/**
 * Opens a new tab for the given target AI.
 * (Auto-pasting into the page is intentionally NOT done here — most chat
 * sites block programmatic focus/paste into their input boxes, and silently
 * injecting text is more fragile than asking the user to paste themselves.
 * The prompt is already on their clipboard via popup.js's copy step.)
 */
async function openTargetAi(targetAi) {
  const url = TARGET_URLS[targetAi] || TARGET_URLS.chatgpt;
  await chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CB_OPEN_TARGET_AI") {
    openTargetAi(message.targetAi)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
