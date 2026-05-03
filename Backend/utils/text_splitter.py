import re
from typing import List

class TextSplitter:
    """
    Advanced Semantic Text Splitter mimicking LangChain's RecursiveCharacterTextSplitter.
    Splits by Paragraphs (\n\n) -> Sentences (. ) -> Words ( ) -> Characters to ensure
    chunks maintain semantic coherence.
    """
    def __init__(self, chunk_size: int = 1500, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""]
        
    def _split_text_with_separator(self, text: str, separator: str) -> List[str]:
        if separator == "":
            return list(text)
        return text.split(separator)

    def split_text(self, text: str) -> List[str]:
        """Split text recursively into semantically coherent chunks."""
        if not text:
            return []
            
        final_chunks = []
        
        # Helper function for recursive splitting
        def _split_recursively(current_text: str, separator_index: int):
            # Base case: if text is smaller than chunk_size, we keep it
            if len(current_text) <= self.chunk_size:
                final_chunks.append(current_text)
                return
                
            # If we've run out of separators, we must forcefully slice it
            if separator_index >= len(self.separators):
                for i in range(0, len(current_text), self.chunk_size - self.chunk_overlap):
                    final_chunks.append(current_text[i:i + self.chunk_size])
                return

            separator = self.separators[separator_index]
            splits = self._split_text_with_separator(current_text, separator)
            
            # If the separator didn't split anything, try the next one
            if len(splits) <= 1:
                _split_recursively(current_text, separator_index + 1)
                return
                
            # Merge smaller splits into a chunk
            current_chunk = []
            current_length = 0
            
            for split in splits:
                split_len = len(split) + (len(separator) if current_chunk else 0)
                
                # If adding this split exceeds chunk size, finalize the current chunk
                if current_length + split_len > self.chunk_size and current_chunk:
                    chunk_text = separator.join(current_chunk)
                    final_chunks.append(chunk_text)
                    
                    # Manage overlap (keep the last few items of current_chunk)
                    overlap_length = 0
                    overlap_chunk = []
                    for item in reversed(current_chunk):
                        if overlap_length + len(item) + len(separator) > self.chunk_overlap:
                            break
                        overlap_chunk.insert(0, item)
                        overlap_length += len(item) + len(separator)
                        
                    current_chunk = overlap_chunk
                    current_length = overlap_length

                # If a single split is still larger than chunk_size, recurse on it
                if len(split) > self.chunk_size:
                    if current_chunk:
                        final_chunks.append(separator.join(current_chunk))
                        current_chunk = []
                        current_length = 0
                    _split_recursively(split, separator_index + 1)
                else:
                    current_chunk.append(split)
                    current_length += split_len
                    
            if current_chunk:
                final_chunks.append(separator.join(current_chunk))

        _split_recursively(text, 0)
        return [chunk.strip() for chunk in final_chunks if chunk.strip()]
