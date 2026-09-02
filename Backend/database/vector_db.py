import os
import math
import uuid
import re
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions


class BM25Index:
    """
    In-memory BM25 index for sparse keyword retrieval (RAG-01).
    Rebuildable on-demand from persisted document chunks.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.corpus: List[Dict[str, Any]] = []
        self.doc_lengths: List[int] = []
        self.avg_doc_len: float = 0.0
        self.doc_freqs: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r'\b\w+\b', text.lower())

    def build(self, documents: List[str], metadatas: List[Dict[str, Any]]):
        self.corpus = []
        self.doc_lengths = []
        self.doc_freqs = {}
        self.idf = {}

        n_docs = len(documents)
        if n_docs == 0:
            return

        total_len = 0
        for i, text in enumerate(documents):
            tokens = self._tokenize(text)
            meta = metadatas[i] if i < len(metadatas) else {}
            doc_len = len(tokens)
            total_len += doc_len
            self.doc_lengths.append(doc_len)
            self.corpus.append({
                "content": text,
                "metadata": meta,
                "tokens": tokens
            })

            seen_terms = set(tokens)
            for term in seen_terms:
                self.doc_freqs[term] = self.doc_freqs.get(term, 0) + 1

        self.avg_doc_len = total_len / n_docs if n_docs > 0 else 0.0

        for term, df in self.doc_freqs.items():
            self.idf[term] = math.log((n_docs - df + 0.5) / (df + 0.5) + 1.0)

    def query(self, query_text: str, n_results: int = 10) -> List[Dict[str, Any]]:
        query_tokens = self._tokenize(query_text)
        scores = []

        for i, doc in enumerate(self.corpus):
            score = 0.0
            doc_len = self.doc_lengths[i]
            tokens = doc["tokens"]
            term_counts = {}
            for t in tokens:
                term_counts[t] = term_counts.get(t, 0) + 1

            for q_term in query_tokens:
                if q_term in term_counts:
                    tf = term_counts[q_term]
                    idf_val = self.idf.get(q_term, 0.0)
                    denom = tf + self.k1 * (1.0 - self.b + self.b * (doc_len / (self.avg_doc_len or 1.0)))
                    score += idf_val * (tf * (self.k1 + 1.0)) / (denom or 1.0)

            if score > 0:
                scores.append((score, doc))

        scores.sort(key=lambda x: x[0], reverse=True)
        return [{"score": s, "content": d["content"], "metadata": d["metadata"]} for s, d in scores[:n_results]]


import threading

# Process-level singleton embedding function and lock
_embedding_fn_lock = threading.Lock()
_shared_embedding_fn = None
_shared_chroma_client = None
_shared_vector_db_instance = None


def get_shared_embedding_fn():
    global _shared_embedding_fn
    if _shared_embedding_fn is None:
        with _embedding_fn_lock:
            if _shared_embedding_fn is None:
                _shared_embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
    return _shared_embedding_fn


def get_shared_chroma_client():
    global _shared_chroma_client
    if _shared_chroma_client is None:
        with _embedding_fn_lock:
            if _shared_chroma_client is None:
                _shared_chroma_client = chromadb.PersistentClient(
                    path=os.getenv("CHROMA_DB_PATH", "./chroma_db"),
                    settings=Settings(anonymized_telemetry=False)
                )
    return _shared_chroma_client


class VectorDB:
    """
    Singleton Vector Database Manager (RAG-01):
    Maintains a single process-wide in-memory instance of SentenceTransformer and ChromaDB client.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(VectorDB, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.client = get_shared_chroma_client()
        self.embedding_fn = get_shared_embedding_fn()
        self.collections_cache: Dict[str, Any] = {}
        self.bm25_indices: Dict[str, BM25Index] = {}
        self._initialized = True

    def warm_up(self):
        """Warm up embedding model and ChromaDB client during application startup"""
        try:
            # 1. Warm embedding function with lightweight probe
            _ = self.embedding_fn(["Shiro AI system initialization probe"])
            # 2. Touch ChromaDB client heartbeat
            _ = self.client.heartbeat()
            return True
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"VectorDB warm_up non-fatal warning: {e}")
            return False

    def create_collection(self, collection_name: str):
        """Get or create collection with cosine similarity and singleton embedding function"""
        if collection_name in self.collections_cache:
            return self.collections_cache[collection_name]
            
        try:
            col = self.client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
                embedding_function=self.embedding_fn
            )
            self.collections_cache[collection_name] = col
            return col
        except Exception:
            try:
                col = self.client.get_collection(
                    name=collection_name, 
                    embedding_function=self.embedding_fn
                )
                self.collections_cache[collection_name] = col
                return col
            except Exception:
                col = self.client.create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"},
                    embedding_function=self.embedding_fn
                )
                self.collections_cache[collection_name] = col
                return col

    def add_documents(self, collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]], ids: Optional[List[str]] = None):
        """Add documents and update in-memory BM25 index"""
        collection = self.create_collection(collection_name)
        if not ids:
            ids = [str(uuid.uuid4()) for _ in documents]
        
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )

        # Build / Rebuild BM25 index for sparse search
        self.rebuild_bm25_index(collection_name, documents, metadatas)
        return ids

    def rebuild_bm25_index(self, collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]]):
        """Lifecycle method: rebuild sparse BM25 index on demand from document chunks"""
        index = BM25Index()
        index.build(documents, metadatas)
        self.bm25_indices[collection_name] = index

    def delete_collection(self, collection_name: str):
        """Delete vector collection and remove BM25 index"""
        try:
            self.client.delete_collection(collection_name)
        except Exception:
            pass
        if collection_name in self.bm25_indices:
            del self.bm25_indices[collection_name]
        return True

    def query_documents(self, collection_name: str, query: str, n_results: int = 5, where: Optional[Dict[str, Any]] = None):
        """Dense semantic search"""
        collection = self.create_collection(collection_name)
        return collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where
        )

    def hybrid_search_with_rerank(
        self,
        collection_name: str,
        query: str,
        user_id: int,
        document_id: Optional[int] = None,
        document_version: Optional[int] = None,
        n_results: int = 5,
        top_k_dense: int = 10,
        top_k_sparse: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Production-Grade Hybrid Search (RAG-01):
        1. Dense semantic search with retrieval-level tenant isolation (`where={"user_id": user_id}`).
        2. Sparse BM25 search.
        3. Reciprocal Rank Fusion: RRF(d) = 1/(60 + rank_dense) + 1/(60 + rank_sparse).
        4. Semantic Reranking with deterministic tie-breaking (RRF score -> chunk_id).
        """
        # Retrieval-level tenant isolation filter with valid ChromaDB $and compound syntax
        clauses: List[Dict[str, Any]] = [{"user_id": user_id}]
        if document_id is not None:
            clauses.append({"document_id": document_id})
        if document_version is not None:
            clauses.append({"document_version": document_version})

        where_filter = clauses[0] if len(clauses) == 1 else {"$and": clauses}


        # 1. Dense Semantic Search
        dense_results = self.query_documents(collection_name, query, n_results=top_k_dense, where=where_filter)
        dense_ranks: Dict[str, int] = {} # chunk_id -> 1-based rank
        dense_data: Dict[str, Dict[str, Any]] = {}

        if dense_results and dense_results.get("documents") and dense_results["documents"]:
            docs = dense_results["documents"][0]
            metas = dense_results["metadatas"][0] if dense_results.get("metadatas") else [{}] * len(docs)
            ids = dense_results["ids"][0] if dense_results.get("ids") else [f"doc_{i}" for i in range(len(docs))]

            for rank, (chunk_id, doc_text, meta) in enumerate(zip(ids, docs, metas), start=1):
                dense_ranks[chunk_id] = rank
                dense_data[chunk_id] = {
                    "chunk_id": chunk_id,
                    "content": doc_text,
                    "metadata": meta
                }

        # 2. Sparse BM25 Search
        sparse_ranks: Dict[str, int] = {}
        if collection_name in self.bm25_indices:
            bm25_results = self.bm25_indices[collection_name].query(query, n_results=top_k_sparse)
            for rank, item in enumerate(bm25_results, start=1):
                meta = item.get("metadata", {})
                # Tenant boundary check in BM25 results
                if meta.get("user_id") is not None and meta.get("user_id") != user_id:
                    continue
                if document_id is not None and meta.get("document_id") != document_id:
                    continue
                if document_version is not None and meta.get("document_version") != document_version:
                    continue

                chunk_id = meta.get("chunk_id", f"sparse_{rank}")
                sparse_ranks[chunk_id] = rank
                if chunk_id not in dense_data:
                    dense_data[chunk_id] = {
                        "chunk_id": chunk_id,
                        "content": item["content"],
                        "metadata": meta
                    }

        # 3. Reciprocal Rank Fusion (RRF)
        all_candidate_ids = set(dense_ranks.keys()).union(set(sparse_ranks.keys()))
        rrf_scores: List[Dict[str, Any]] = []

        k = 60 # Standard RRF smoothing factor
        for cid in all_candidate_ids:
            r_dense = dense_ranks.get(cid, 9999)
            r_sparse = sparse_ranks.get(cid, 9999)
            score = (1.0 / (k + r_dense)) + (1.0 / (k + r_sparse))
            
            chunk_info = dense_data[cid]
            meta = chunk_info["metadata"]
            rrf_scores.append({
                "chunk_id": cid,
                "content": chunk_info["content"],
                "document_id": meta.get("document_id"),
                "document_version": meta.get("document_version", 1),
                "page_number": meta.get("page_number", 1),
                "filename": meta.get("filename", "Document.pdf"),
                "rrf_score": score,
                "metadata": meta
            })

        # 4. Deterministic Sort by RRF score descending, then chunk_id ascending
        rrf_scores.sort(key=lambda x: (-x["rrf_score"], x["chunk_id"]))
        return rrf_scores[:n_results]