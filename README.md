# Challenge B — AI Agent for PDF Summarization & Question Answering

An AI system that ingests a PDF, builds a vector index using **ChromaDB**, and answers questions using **Google Gemini (ADK)** via Retrieval-Augmented Generation (RAG). Includes a full **React frontend** with drag-and-drop upload, chat UI, and dark/light mode toggle.

---

## Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/slooze-challenge-b.git
cd slooze-challenge-b
```

### 2. Create a Python virtual environment
```bash
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows
```

### 3. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up API key
```bash
cp .env.example .env
```
Edit `.env` and fill in your key:
```
GOOGLE_API_KEY=your_google_api_key_here
```
- **GOOGLE_API_KEY** → https://aistudio.google.com/app/apikey (free)

> Only one key needed — both embeddings and LLM use Google's API.

---

## How to Run the Project

### Backend (Terminal 1)
```bash
uvicorn server:app --reload --port 8000
```

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### Using the App
1. Drag and drop a PDF onto the upload zone (or click to browse)
2. Click **"Index & Analyze PDF"** and wait for indexing to complete
3. Type any question in the chat box and press Enter
4. Get grounded answers sourced directly from your document

### (Optional) CLI mode — no frontend needed
```bash
python agent/pdf_qa_agent.py path/to/your/document.pdf
```

### Deployment
- **Backend** → [Render.com](https://render.com) — connect GitHub repo, set `GOOGLE_API_KEY` env var, deploy
- **Frontend** → [Vercel.com](https://vercel.com) — set root directory to `frontend`, add `VITE_API_URL=<your_render_url>`
- After both deploy, set `FRONTEND_URL=<your_vercel_url>` on Render and redeploy

---

## Dependencies Used

| Package | Purpose |
|---|---|
| `google-generativeai` | Google Gemini 1.5 Flash LLM + Embedding API |
| `google-adk` | Google Agent Development Kit |
| `chromadb` | Local persistent vector store |
| `PyMuPDF` | Fast, accurate PDF text extraction |
| `fastapi` | REST API framework |
| `uvicorn` | ASGI server |
| `python-multipart` | PDF file upload handling |
| `python-dotenv` | Load API keys from `.env` |
| `react` + `vite` | Frontend UI framework |
| `react-markdown` | Render markdown in chat answers |

---

## Architecture Overview

```
User (React UI)
    │
    ├── Drag & drop PDF
    │       │  POST /upload  (multipart form)
    │       ▼
    │   FastAPI Backend  (server.py)
    │       │
    │       ├──▶  PyMuPDF
    │       │         extracts text page by page
    │       │
    │       ├──▶  Text Chunker
    │       │         800-word chunks, 150-word overlap
    │       │
    │       ├──▶  Google Embedding API (embedding-001)
    │       │         generates vector embeddings
    │       │
    │       └──▶  ChromaDB  (persistent local store)
    │                 stores chunks + embeddings
    │                 returns session_id to UI
    │
    └── Ask a question
            │  POST /ask  { session_id, question }
            ▼
        ChromaDB cosine similarity search
            top-5 most relevant chunks retrieved
            │
        Google Gemini 1.5 Flash
            generates grounded answer from context
            │
        { answer }  →  Chat UI renders markdown
```

### Project Structure

```
challenge-b/
├── agent/
│   └── pdf_qa_agent.py        # Core RAG pipeline: extract → chunk → embed → retrieve → generate
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # React UI: upload + chat + dark/light toggle
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server.py                   # FastAPI REST API server
├── render.yaml                 # Render deployment config
├── requirements.txt
├── .env.example
└── README.md
```

---

## Design Decisions and Trade-offs

| Decision | Reason | Trade-off |
|---|---|---|
| **ChromaDB** as vector store | Local, zero-setup, persists across runs, no extra API needed | Not suitable for scaling to millions of documents |
| **Google embedding-001** | Same API key as Gemini — one key for everything, good quality embeddings | Tied to Google ecosystem |
| **PyMuPDF** for extraction | Fastest PDF library, handles complex multi-column layouts accurately | Struggles with scanned / image-only PDFs (no OCR) |
| **800-word chunk size** | Balances retrieval precision with enough surrounding context per chunk | Larger chunks can introduce noise into retrieved results |
| **150-word overlap** | Prevents important context from being lost at chunk boundaries | Slight duplication in stored data |
| **Top-5 retrieval** | Provides enough context for quality answers without overwhelming the LLM | May miss relevant info in very large documents |
| **MD5 hash-based caching** | Same PDF is never re-indexed twice — saves time and API costs | Cache must be manually cleared if PDF content changes |
| **Session-based collection store** | Keeps backend stateless and simple, no database required | Sessions are lost if the server restarts |
| **react-markdown** in frontend | Properly renders bold, bullets, and headings from LLM output | Small extra dependency |
| **CORS + env-based API URL** | Works for both local dev and production without code changes | Requires setting `VITE_API_URL` on Vercel |
