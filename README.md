# ContextBridge AI

Transfer your conversation context seamlessly between ChatGPT, Claude, Gemini, Grok, and Perplexity — without copy-pasting the whole chat or re-explaining everything from scratch.

```
ContextBridge-AI/
├── backend/        FastAPI + LangChain + Gemini service
└── extension/      Manifest V3 Chrome extension
```

---

## 1. Prerequisites

- Python 3.11+
- Google Chrome (or any Chromium-based browser)
- A Google Gemini API key — get one free at https://aistudio.google.com/app/apikey

---

## 2. Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Now open .env and paste your real key:
#   GEMINI_API_KEY=AIza...
```

### Run it

```bash
uvicorn main:app --reload
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Test it — Step by step

**a) Health check**
```bash
curl http://127.0.0.1:8000/health
```
Expected:
```json
{"status":"ok","service":"ContextBridge AI"}
```

**b) Interactive API docs**
Open in your browser: `http://127.0.0.1:8000/docs`
This gives you a UI to test `/summarize` and `/reconstruct` without writing any curl commands.

**c) Test /summarize with a real call**
```bash
curl -X POST http://127.0.0.1:8000/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "source_ai": "claude",
    "conversation": "User: I want to build a to-do app with React and Firebase.\nClaude: Sure, let'\''s start with the project setup using Vite and Firebase auth.\nUser: Great, let'\''s also add dark mode.\nClaude: I'\''ll add a theme toggle using Tailwind dark mode classes."
  }'
```
Expected: a JSON `project_state` object with `objective`, `decisions`, `next_steps`, etc. filled in based on that text.

**d) Test /reconstruct**
Take the `project_state` JSON returned above and POST it back:
```bash
curl -X POST http://127.0.0.1:8000/reconstruct \
  -H "Content-Type: application/json" \
  -d '{
    "project_state": { ...paste the project_state object here... },
    "target_ai": "chatgpt"
  }'
```
Expected: `{"prompt": "Continue this conversation on chatgpt. ..."}`

> If your API key is missing/invalid or there's a network issue, `/reconstruct` will NOT error out — it automatically falls back to a deterministic template (see `services/prompt_service.py`) so the extension still works end-to-end. Check the terminal logs for a "using fallback template" warning if this happens.

---

## 3. Load the Extension in Chrome

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Confirm "ContextBridge AI" appears with no red error text. If there's an error, click "Errors" to see what's wrong (commonly: a typo in `manifest.json`).

### Point the extension at your backend

By default the extension calls `http://127.0.0.1:8000` (set in `storage.js` → `CB_DEFAULT_BACKEND_URL`). If your backend runs on a different port or you've deployed to Render, update that constant or — better — open the extension's background page console and run:

```js
CBStorage.setBackendUrl("https://your-render-url.onrender.com")
```

---

## 4. End-to-End Test

1. Make sure the backend is running (`uvicorn main:app --reload`).
2. Go to **claude.ai** and open any existing conversation with a few back-and-forth messages.
3. Click the ContextBridge AI extension icon.
4. Set **Source AI** = Claude, **Target AI** = ChatGPT.
5. Click **Transfer Context**.
6. Watch the status messages:
   - "Extracting conversation from the current tab..."
   - "Summarizing context with ContextBridge AI backend..."
   - "Generating continuation prompt..."
   - "Done! Review the prompt below."
7. A text box appears with the generated prompt — edit it if you want.
8. Click **Copy Prompt**, then **Open Target AI** — a new tab opens to ChatGPT.
9. Paste the prompt into ChatGPT and confirm it picks up the context correctly.
10. Click **View History** in the popup to confirm the session was saved.

---

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Could not establish connection. Receiving end does not exist." | Content script not loaded — wrong tab, or page loaded before extension was installed | Refresh the source AI's tab, then try again |
| "No conversation text found on this page" | Site's DOM changed, selectors no longer match | Inspect the page, update the `SELECTORS` object at the top of the matching `content_scripts/*.js` file |
| `/summarize` returns 502 | LLM call failed (bad API key, quota, network) | Check backend terminal logs; verify `GEMINI_API_KEY` in `.env` |
| CORS error in popup console | Backend `ALLOWED_ORIGINS` doesn't include your extension's origin | During development leave it as `*`; for production set it to `chrome-extension://<your-extension-id>` |
| Extension won't load — manifest error | Typo/missing field in `manifest.json` | Check the red error text on `chrome://extensions` |

---

## 6. Deploying the Backend (Render)

1. Push the `backend/` folder to a GitHub repo.
2. On Render: New → Web Service → connect the repo.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables in the Render dashboard: `GEMINI_API_KEY`, `ALLOWED_ORIGINS` (set to your real extension origin once published), `GEMINI_MODEL`.
6. Once deployed, update `CB_DEFAULT_BACKEND_URL` in `extension/storage.js` to your Render URL and reload the unpacked extension.

---

## 7. Known Limitations (read before extending)

- **DOM scraping is fragile by nature.** Each `content_scripts/*.js` file's `SELECTORS` will need occasional maintenance as ChatGPT/Claude/Gemini/Grok/Perplexity update their UIs.
- **No auto-paste into the target AI's input box.** Most chat sites block programmatic focus/paste for security reasons — the extension copies the prompt to your clipboard and opens the tab; you paste manually (Ctrl/Cmd+V).
- **Long conversations are truncated**, not map-reduce summarized — `MAX_CONVERSATION_CHARS` in `.env` controls this. For very long threads, only the most recent portion is sent.
- **`langchain-google-genai`** currently depends on the deprecated `google.generativeai` package (you'll see a `FutureWarning` on startup). It still works, but watch for a future LangChain release that migrates to `google-genai` and update `requirements.txt` accordingly.
