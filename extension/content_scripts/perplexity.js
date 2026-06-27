/**
 * content_scripts/perplexity.js
 *
 * Extracts the visible conversation (query + answer pairs) from
 * www.perplexity.ai. Perplexity threads are usually shorter than chat-style
 * tools, but the same scroll-and-collect pattern is used for consistency.
 */

const SELECTORS = {
  queryBlock: '[class*="query"], h1, h2',
  answerBlock: '[class*="answer"], [class*="prose"]',
};

async function scrollToLoadFullHistory(maxScrolls = 20, delayMs = 350) {
  const scrollable = document.scrollingElement || document.body;

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

async function extractPerplexityConversation() {
  await scrollToLoadFullHistory();

  // Perplexity threads alternate: a query heading, followed by an answer block.
  // We walk the main content area in document order rather than querying
  // queries/answers separately, since pairing by index is unreliable if
  // counts don't match (ads, follow-up suggestions, etc. can interleave).
  const main = document.querySelector("main") || document.body;
  const candidates = Array.from(
    main.querySelectorAll(`${SELECTORS.queryBlock}, ${SELECTORS.answerBlock}`)
  );

  const lines = [];
  let seenAny = false;
  for (const node of candidates) {
    const isQuery = node.matches(SELECTORS.queryBlock);
    const text = nodeToMarkdown(node);
    if (!text) continue;
    seenAny = true;
    lines.push(`### ${isQuery ? "User" : "Perplexity"}\n${text}`);
  }

  if (!seenAny) {
    // Fallback: just grab all visible text in main if structured selectors miss.
    return main.innerText.trim();
  }

  return lines.join("\n\n");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CB_EXTRACT_CONVERSATION") {
    extractPerplexityConversation()
      .then((conversation) => sendResponse({ ok: true, source_ai: "perplexity", conversation }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
