/**
 * popup.js — wires up the popup UI:
 *   1. Find the active tab and ask its content script to extract the conversation.
 *   2. Send that text to the backend /summarize endpoint.
 *   3. Send the resulting ProjectState to /reconstruct.
 *   4. Display the generated prompt, let the user copy it / open the target AI.
 *   5. Save the completed session to history.
 */

const sourceAiSelect = document.getElementById("sourceAi");
const targetAiSelect = document.getElementById("targetAi");
const btnTransfer = document.getElementById("btnTransfer");
const statusBox = document.getElementById("statusBox");
const promptBox = document.getElementById("promptBox");
const promptText = document.getElementById("promptText");
const btnCopy = document.getElementById("btnCopy");
const btnOpenTarget = document.getElementById("btnOpenTarget");
const btnShowHistory = document.getElementById("btnShowHistory");
const btnBackToTransfer = document.getElementById("btnBackToTransfer");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");

let lastProjectState = null;

function setStatus(message, kind = "info") {
  statusBox.textContent = message;
  statusBox.classList.remove("hidden", "error", "success");
  if (kind === "error") statusBox.classList.add("error");
  if (kind === "success") statusBox.classList.add("success");
}

function clearStatus() {
  statusBox.classList.add("hidden");
  statusBox.textContent = "";
}

function setLoading(isLoading) {
  btnTransfer.disabled = isLoading;
  btnTransfer.textContent = isLoading ? "Transferring..." : "Transfer Context";
}

/**
 * Sends a message to the active tab's content script and returns its response.
 */
function sendMessageToActiveTab(message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        reject(new Error("No active tab found."));
        return;
      }
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              `${chrome.runtime.lastError.message} — make sure you're on the source AI's site and the page has finished loading.`
            )
          );
          return;
        }
        resolve(response);
      });
    });
  });
}

async function callBackend(path, body) {
  const backendUrl = await CBStorage.getBackendUrl();
  const res = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail ? JSON.stringify(errorBody.detail) : `Request failed (${res.status})`);
  }

  return res.json();
}

async function handleTransfer() {
  clearStatus();
  promptBox.classList.add("hidden");
  setLoading(true);

  const sourceAi = sourceAiSelect.value;
  const targetAi = targetAiSelect.value;

  try {
    setStatus("Extracting conversation from the current tab...");
    const extraction = await sendMessageToActiveTab({ type: "CB_EXTRACT_CONVERSATION" });

    if (!extraction?.ok) {
      throw new Error(extraction?.error || "Extraction failed.");
    }
    if (!extraction.conversation || extraction.conversation.trim().length === 0) {
      throw new Error(
        "No conversation text found on this page. Make sure you're viewing an active chat."
      );
    }

    setStatus("Summarizing context with ContextBridge AI backend...");
    const summarizeResult = await callBackend("/summarize", {
      source_ai: sourceAi,
      conversation: extraction.conversation,
    });
    lastProjectState = summarizeResult.project_state;

    setStatus("Generating continuation prompt...");
    const reconstructResult = await callBackend("/reconstruct", {
      project_state: lastProjectState,
      target_ai: targetAi,
    });

    promptText.value = reconstructResult.prompt;
    promptBox.classList.remove("hidden");
    setStatus("Done! Review the prompt below.", "success");

    await CBStorage.saveSession({
      id: crypto.randomUUID(),
      sourceAi,
      targetAi,
      timestamp: new Date().toISOString(),
      projectState: lastProjectState,
      prompt: reconstructResult.prompt,
    });
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(promptText.value);
    setStatus("Copied to clipboard.", "success");
  } catch (err) {
    setStatus(`Could not copy: ${err.message}`, "error");
  }
}

async function handleOpenTarget() {
  const targetAi = targetAiSelect.value;

  // Make sure the latest prompt edits are on the clipboard before opening the new tab.
  try {
    await navigator.clipboard.writeText(promptText.value);
  } catch (err) {
    console.warn("Clipboard copy failed before opening target AI:", err);
  }

  chrome.runtime.sendMessage({ type: "CB_OPEN_TARGET_AI", targetAi }, (response) => {
    if (!response?.ok) {
      setStatus(`Could not open ${targetAi}: ${response?.error || "unknown error"}`, "error");
    } else {
      setStatus(`Opened ${targetAi}. Paste the prompt to continue.`, "success");
    }
  });
}

function renderHistoryItem(session) {
  const li = document.createElement("li");
  li.className = "history-item";

  const route = document.createElement("div");
  route.className = "route";
  route.textContent = `${session.sourceAi} → ${session.targetAi}`;

  const timestamp = document.createElement("div");
  timestamp.className = "timestamp";
  timestamp.textContent = new Date(session.timestamp).toLocaleString();

  li.appendChild(route);
  li.appendChild(timestamp);

  li.addEventListener("click", () => {
    promptText.value = session.prompt;
    promptBox.classList.remove("hidden");
    sourceAiSelect.value = session.sourceAi;
    targetAiSelect.value = session.targetAi;
    showView("transfer");
  });

  return li;
}

async function renderHistory() {
  const history = await CBStorage.getHistory();
  historyList.innerHTML = "";

  if (history.length === 0) {
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");
  for (const session of history) {
    historyList.appendChild(renderHistoryItem(session));
  }
}

function showView(name) {
  document.getElementById("view-transfer").classList.toggle("active", name === "transfer");
  document.getElementById("view-history").classList.toggle("active", name === "history");
}

btnTransfer.addEventListener("click", handleTransfer);
btnCopy.addEventListener("click", handleCopy);
btnOpenTarget.addEventListener("click", handleOpenTarget);
btnShowHistory.addEventListener("click", async () => {
  await renderHistory();
  showView("history");
});
btnBackToTransfer.addEventListener("click", () => showView("transfer"));
