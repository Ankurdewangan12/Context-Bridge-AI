/**
 * storage.js — wrapper around chrome.storage.local.
 *
 * Everything here is loaded as a plain script (not an ES module) so it can
 * be included directly in popup.html via <script src="storage.js">.
 * Functions are attached to a global `CBStorage` object.
 */

const CB_HISTORY_KEY = "cb_session_history";
const CB_BACKEND_URL_KEY = "cb_backend_url";
const CB_DEFAULT_BACKEND_URL = "http://127.0.0.1:8000"; // change to your deployed Render URL

const CBStorage = {
  /**
   * Get the configured backend URL, falling back to the local default.
   */
  async getBackendUrl() {
    const result = await chrome.storage.local.get(CB_BACKEND_URL_KEY);
    return result[CB_BACKEND_URL_KEY] || CB_DEFAULT_BACKEND_URL;
  },

  async setBackendUrl(url) {
    await chrome.storage.local.set({ [CB_BACKEND_URL_KEY]: url });
  },

  /**
   * Save a completed transfer session to history.
   * session = { id, sourceAi, targetAi, timestamp, projectState, prompt }
   */
  async saveSession(session) {
    const history = await this.getHistory();
    history.unshift(session); // newest first

    // Keep history from growing unbounded — cap at 50 sessions.
    const trimmed = history.slice(0, 50);

    await chrome.storage.local.set({ [CB_HISTORY_KEY]: trimmed });
    return trimmed;
  },

  async getHistory() {
    const result = await chrome.storage.local.get(CB_HISTORY_KEY);
    return result[CB_HISTORY_KEY] || [];
  },

  async getSessionById(id) {
    const history = await this.getHistory();
    return history.find((s) => s.id === id) || null;
  },

  async clearHistory() {
    await chrome.storage.local.remove(CB_HISTORY_KEY);
  },
};

// Expose globally for popup.js / background.js to use.
self.CBStorage = CBStorage;
