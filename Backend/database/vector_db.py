import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
import os
from typing import List, Dict, Any
import uuid

class VectorDB:
    def __init__(self):
        self.client = chromadb.PersistentClient(
            path=os.getenv("CHROMA_DB_PATH", "./chroma_db"),
            settings=Settings(anonymized_telemetry=False)
        )
        self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    
    def create_collection(self, collection_name: str):
        """Create a new collection for document embeddings"""
        try:
            collection = self.client.create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"},
                embedding_function=self.embedding_fn
            )
            return collection
        except Exception:
            return self.client.get_collection(
                name=collection_name, 
                embedding_function=self.embedding_fn
            )
    
    def add_documents(self, collection_name: str, documents: List[str], metadatas: List[Dict[str, Any]]):
        """Add documents to a collection"""
        collection = self.create_collection(collection_name)
        ids = [str(uuid.uuid4()) for _ in documents]
        
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        return ids
    
    def query_documents(self, collection_name: str, query: str, n_results: int = 5):
        """Query documents from collection"""
        collection = self.create_collection(collection_name)
        results = collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results
    
    def delete_collection(self, collection_name: str):
        """Delete a collection"""
        try:
            self.client.delete_collection(collection_name)
            return True
        except Exception:
            return False