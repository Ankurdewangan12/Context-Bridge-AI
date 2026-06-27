/**
 * content_scripts/gemini.js
 *
 * Extracts the visible conversation from gemini.google.com.
 * Gemini's DOM uses custom web components, so role detection leans on
 * tag names rather than data-testid attributes. Update SELECTORS if the
 * page structure changes.
 */

const SELECTORS = {
  userTurn: "user-query",
  modelTurn: "model-response",
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

async function extractGeminiConversation() {
  await scrollToLoadFullHistory();

  // Gemini renders turns as custom elements in document order, so we can
  // query both types together and preserve order via DOM position.
  const allTurns = Array.from(
    document.querySelectorAll(`${SELECTORS.userTurn}, ${SELECTORS.modelTurn}`)
  );

  const lines = [];
  for (const turn of allTurns) {
    const role = turn.tagName.toLowerCase() === SELECTORS.userTurn ? "User" : "Gemini";
    const text = nodeToMarkdown(turn);
    if (text) {
      lines.push(`### ${role}\n${text}`);
    }
  }

  return lines.join("\n\n");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CB_EXTRACT_CONVERSATION") {
    extractGeminiConversation()
      .then((conversation) => sendResponse({ ok: true, source_ai: "gemini", conversation }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
