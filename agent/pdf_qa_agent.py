import os
import sys
import hashlib
from pathlib import Path
from dotenv import load_dotenv

import fitz  # PyMuPDF
import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
import google.generativeai as genai

load_dotenv()

# Initialize Gemini (only for answer generation, not embeddings)
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

# Local MiniLM embedding — no API key needed, runs fully offline
CHROMA_PATH = "./chroma_store"

minilm_ef = SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)


# ──────────────────────────────────────────────
# 1. PDF TEXT EXTRACTION
# ──────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from a PDF using PyMuPDF."""
    doc = fitz.open(pdf_path)
    full_text = []
    for page_num, page in enumerate(doc, start=1):
        text = page.get_text("text")
        if text.strip():
            full_text.append(f"[Page {page_num}]\n{text.strip()}")
    doc.close()
    print(f"  Extracted text from {len(full_text)} pages.")
    return "\n\n".join(full_text)


# ──────────────────────────────────────────────
# 2. CHUNKING
# ──────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks for better retrieval."""
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap

    print(f"  Created {len(chunks)} chunks (size={chunk_size}, overlap={overlap}).")
    return chunks


# ──────────────────────────────────────────────
# 3. EMBED + STORE IN CHROMADB
# ──────────────────────────────────────────────

def get_pdf_hash(pdf_path: str) -> str:
    """Get MD5 hash of PDF to detect if already indexed."""
    with open(pdf_path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def index_pdf(pdf_path: str, force_reindex: bool = False) -> chromadb.Collection:
    """Extract, chunk, embed and store PDF in ChromaDB. Skips if already indexed."""
    pdf_hash = get_pdf_hash(pdf_path)
    collection_name = f"pdf_{pdf_hash[:12]}"

    # Check if already indexed
    existing = [c.name for c in chroma_client.list_collections()]
    if collection_name in existing and not force_reindex:
        print(f"  PDF already indexed. Loading from cache (collection: {collection_name}).")
        # Delete and reindex to avoid embedding function conflicts
        chroma_client.delete_collection(collection_name)
        print(f"  Reindexing with current embedding function...")

    # Create fresh collection
    if collection_name in existing:
        chroma_client.delete_collection(collection_name)

    collection = chroma_client.create_collection(
        name=collection_name,
        embedding_function=minilm_ef,
        metadata={"hnsw:space": "cosine"}
    )

    print("[2/4] Extracting text from PDF...")
    text = extract_text_from_pdf(pdf_path)

    print("[3/4] Chunking text...")
    chunks = chunk_text(text)

    print("[4/4] Generating embeddings with MiniLM and storing in ChromaDB...")
    batch_size = 50
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        ids = [f"chunk_{i + j}" for j in range(len(batch))]
        collection.add(documents=batch, ids=ids)
        print(f"  Stored chunks {i+1}–{i+len(batch)} / {len(chunks)}")

    print(f"  Indexing complete. {len(chunks)} chunks stored.")
    return collection


# ──────────────────────────────────────────────
# 4. RETRIEVAL
# ──────────────────────────────────────────────

def retrieve_context(collection: chromadb.Collection, query: str, top_k: int = 5) -> str:
    """Retrieve most relevant chunks using local MiniLM vector similarity search."""
    results = collection.query(
        query_texts=[query],
        n_results=max(1, min(top_k, collection.count())),
    )
    chunks = results["documents"][0]
    context = "\n\n---\n\n".join(chunks)
    return context


# ──────────────────────────────────────────────
# 5. ANSWER GENERATION
# ──────────────────────────────────────────────

def generate_answer(question: str, context: str) -> str:
    """Use Gemini to answer the question based on retrieved context."""
    prompt = f"""You are an expert document analyst. Answer the user's question using ONLY the document excerpts provided below.

Document Excerpts:
{context}

User Question: {question}

Instructions:
- Answer based strictly on the provided document content
- If the document doesn't contain enough information, clearly state that
- Be detailed and precise
- For summarization requests, cover the main topics, objectives, findings, and conclusions
- Do not fabricate any information

Answer:"""

    response = model.generate_content(prompt)
    return response.text.strip()


# ──────────────────────────────────────────────
# 6. MAIN AGENT
# ──────────────────────────────────────────────

def run_agent(pdf_path: str) -> None:
    """Full RAG pipeline: ingest PDF → interactive Q&A loop."""
    if not Path(pdf_path).exists():
        print(f"Error: File '{pdf_path}' not found.")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"PDF QA Agent (Google Gemini + MiniLM + ChromaDB)")
    print(f"Document: {pdf_path}")
    print("="*60)

    print("\n[1/4] Indexing PDF into ChromaDB...")
    collection = index_pdf(pdf_path)

    print("\nPDF ready! Start asking questions. Type 'exit' to quit.\n")
    print("-" * 60)

    while True:
        question = input("\nYour question: ").strip()
        if question.lower() in ("exit", "quit", "q"):
            print("Goodbye!")
            break
        if not question:
            continue

        print("\nRetrieving relevant sections...")
        context = retrieve_context(collection, question, top_k=5)

        print("Generating answer with Gemini...\n")
        answer = generate_answer(question, context)

        print("Answer:")
        print("-" * 40)
        print(answer)
        print("-" * 40)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python agent/pdf_qa_agent.py <path_to_pdf>")
        print("Example: python agent/pdf_qa_agent.py document.pdf")
        sys.exit(1)

    pdf_path = sys.argv[1]
    run_agent(pdf_path)