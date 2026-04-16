from typing import List
import re

class TextSplitter:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def split_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks"""
        if not text or len(text) <= self.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Find chunk end
            end = start + self.chunk_size
            
            if end >= len(text):
                chunks.append(text[start:])
                break
            
            # Try to split at sentence boundary
            chunk = text[start:end]
            
            # Look for sentence ending near the chunk boundary
            sentence_endings = ['. ', '! ', '? ', '\n\n']
            best_split = end
            
            for ending in sentence_endings:
                last_occurrence = chunk.rfind(ending)
                if last_occurrence > self.chunk_size * 0.7:  # Don't split too early
                    best_split = start + last_occurrence + len(ending)
                    break
            
            chunks.append(text[start:best_split])
            start = best_split - self.chunk_overlap
        
        return [chunk.strip() for chunk in chunks if chunk.strip()]