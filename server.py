import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent.pdf_qa_agent import index_pdf, retrieve_context, generate_answer

app = FastAPI(title="Slooze PDF QA Agent API")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.environ.get("FRONTEND_URL", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in origins if o],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

_collection_store = {}

class QuestionRequest(BaseModel):
    session_id: str
    question: str

@app.get("/")
def root():
    return {"message": "Slooze PDF QA Agent API is running!"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        collection = index_pdf(tmp_path)
        session_id = collection.name
        _collection_store[session_id] = collection
        return {
            "session_id": session_id,
            "filename": file.filename,
            "chunk_count": collection.count(),
            "message": "PDF indexed successfully.",
        }
    finally:
        os.unlink(tmp_path)

@app.post("/ask")
def ask(req: QuestionRequest):
    collection = _collection_store.get(req.session_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a PDF first.")
    context = retrieve_context(collection, req.question, top_k=5)
    answer = generate_answer(req.question, context)
    return {"answer": answer}
