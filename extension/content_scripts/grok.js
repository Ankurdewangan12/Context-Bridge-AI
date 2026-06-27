/**
 * content_scripts/grok.js
 *
 * Extracts the visible conversation from grok.com (or x.com/i/grok).
 * Grok's UI is the least stable of the supported platforms — treat these
 * selectors as a starting point and verify against the live DOM.
 */

const SELECTORS = {
  turnContainer: '[class*="message-row"], [class*="message-bubble"]',
  fallbackTurn: "main [class*='message']",
};

async function scrollToLoadFullHistory(maxScrolls = 30, delayMs = 350) {
  const scrollable = document.querySelector("main") || document.scrollingElement || document.body;

  let lastHeight = -1;
  for (let i = 0; i < maxScrolls; i++) {
    scrollable.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, delayMs));
    const currentHeight = scrollable.scrollHeight;
    if (currentHeight === lastHeight) break;
    lastHeight = currentHeight;
  }
  scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: "instant" });
}

function nodeToMarkdown(node) {
  const clone = node.cloneNode(true);

  clone.querySelectorAll("pre").forEach((pre) => {
    const codeText = pre.innerText.trim();
    pre.replaceWith(document.createTextNode(`\n\`\`\`\n${codeText}\n\`\`\`\n`));
  });

  clone.querySelectorAll("code").forEach((code) => {
    code.replaceWith(document.createTextNode(`\`${code.innerText}\``));
  });

  return clone.innerText.trim();
}

function detectRole(turnNode) {
  const cls = turnNode.className || "";
  if (/user/i.test(cls)) return "User";
  if (/assistant|grok|bot/i.test(cls)) return "Grok";
  return turnNode.closest('[class*="justify-end"]') ? "User" : "Grok";
}

async function extractGrokConversation() {
  await scrollToLoadFullHistory();

  let turns = Array.from(document.querySelectorAll(SELECTORS.turnContainer));
  if (turns.length === 0) {
    turns = Array.from(document.querySelectorAll(SELECTORS.fallbackTurn));
  }

  const lines = [];
  for (const turn of turns) {
    const role = detectRole(turn);
    const text = nodeToMarkdown(turn);
    if (text) {
      lines.push(`### ${role}\n${text}`);
    }
  }

  return lines.join("\n\n");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CB_EXTRACT_CONVERSATION") {
    extractGrokConversation()
      .then((conversation) => sendResponse({ ok: true, source_ai: "grok", conversation }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
