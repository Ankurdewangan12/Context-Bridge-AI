/**
 * content_scripts/chatgpt.js
 *
 * Extracts the visible conversation from chatgpt.com / chat.openai.com.
 * Selectors are best-effort — ChatGPT's DOM changes periodically. If
 * extraction breaks, inspect the live page and update SELECTORS only.
 */

const SELECTORS = {
  turnContainer: '[data-testid^="conversation-turn-"]',
  fallbackTurn: "article",
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
    const langMatch = pre.querySelector("code")?.className?.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "";
    pre.replaceWith(document.createTextNode(`\n\`\`\`${lang}\n${codeText}\n\`\`\`\n`));
  });

  clone.querySelectorAll("code").forEach((code) => {
    code.replaceWith(document.createTextNode(`\`${code.innerText}\``));
  });

  return clone.innerText.trim();
}

function detectRole(turnNode) {
  const author = turnNode.getAttribute("data-message-author-role");
  if (author) return author === "user" ? "User" : "ChatGPT";
  return turnNode.querySelector('[data-message-author-role="user"]') ? "User" : "ChatGPT";
}

async function extractChatGptConversation() {
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
    extractChatGptConversation()
      .then((conversation) => sendResponse({ ok: true, source_ai: "chatgpt", conversation }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
