/**
 * content_scripts/claude.js
 *
 * Extracts the visible conversation from claude.ai.
 *
 * IMPORTANT: Claude's DOM structure can change over time. The selectors below
 * are best-effort as of this writing. If extraction returns empty or garbled
 * text, check the live DOM (Inspect Element) and update SELECTORS below —
 * the rest of this file should not need to change.
 */

const SELECTORS = {
  // Each "turn" (human or assistant message) container.
  turnContainer: '[data-testid="user-message"], [data-testid="conversation-turn"]',
  // Fallback: any element that looks like a message bubble.
  fallbackTurn: "main [class*='message'], main [class*='turn']",
};

/**
 * Scrolls the chat container to the top in increments so that virtualized /
 * lazy-loaded message lists fully render before we read the DOM.
 */
async function scrollToLoadFullHistory(maxScrolls = 30, delayMs = 350) {
  const scrollable =
    document.querySelector("main") || document.scrollingElement || document.body;

  let lastHeight = -1;
  for (let i = 0; i < maxScrolls; i++) {
    scrollable.scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, delayMs));

    const currentHeight = scrollable.scrollHeight;
    if (currentHeight === lastHeight) break; // no more new content loaded
    lastHeight = currentHeight;
  }

  // Leave the user's scroll position roughly where it was (bottom).
  scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: "instant" });
}

/**
 * Converts a message DOM node into clean markdown-ish text, preserving
 * code blocks and basic structure rather than flattening everything.
 */
function nodeToMarkdown(node) {
  const clone = node.cloneNode(true);

  // Preserve code blocks as fenced markdown.
  clone.querySelectorAll("pre").forEach((pre) => {
    const codeText = pre.innerText.trim();
    const langMatch = pre.querySelector("code")?.className?.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "";
    pre.replaceWith(document.createTextNode(`\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`));
  });

  // Preserve inline code.
  clone.querySelectorAll("code").forEach((code) => {
    code.replaceWith(document.createTextNode(`\`${code.innerText}\``));
  });

  return clone.innerText.trim();
}

function detectRole(turnNode) {
  const text = (turnNode.getAttribute("data-testid") || "") + " " + (turnNode.className || "");
  if (/user/i.test(text)) return "User";
  if (/assistant|claude/i.test(text)) return "Claude";
  // Heuristic fallback based on common alignment classes
  return turnNode.closest('[class*="justify-end"]') ? "User" : "Claude";
}

async function extractClaudeConversation() {
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

// Listen for extraction requests from the popup/background.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CB_EXTRACT_CONVERSATION") {
    extractClaudeConversation()
      .then((conversation) => {
        sendResponse({ ok: true, source_ai: "claude", conversation });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: String(err) });
      });
    return true; // keep the message channel open for the async response
  }
});
