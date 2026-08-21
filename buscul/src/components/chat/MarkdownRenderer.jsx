import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const CitationButton = ({ id, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center w-5 h-5 ml-1 text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-all"
  >
    {id.split('-')[1]}
  </button>
);

const MarkdownRenderer = ({ content, citations = [], onCitationClick }) => {
  // Replace [cit-N] with a custom component using a regex
  // ReactMarkdown doesn't easily support custom components for text patterns,
  // so we'll preprocess the text to identify citations.

  const parts = content.split(/(\[cit-\d+\])/g);

  return (
    <div className="prose prose-invert max-w-none">
      {parts.map((part, index) => {
        const match = part.match(/\[cit-(\d+)\]/);
        if (match) {
          const citId = part.slice(1, -1);
          const citation = citations.find(c => c.id === citId);
          return (
            <CitationButton 
              key={index} 
              id={citId} 
              onClick={() => citation && onCitationClick(citation)} 
            />
          );
        }
        return (
          <ReactMarkdown 
            key={index} 
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              p: ({children}) => <span className="inline">{children}</span>
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};

export default MarkdownRenderer;
