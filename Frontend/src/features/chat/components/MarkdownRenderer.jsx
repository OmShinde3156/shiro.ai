import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Copy, Check, Terminal } from "lucide-react";

const CodeBlock = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-surface-elevated)] shadow-sm">
      {/* Code Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2 font-mono">
          <Terminal className="w-3.5 h-3.5 text-[#89A88D]" />
          <span>{language || "code"}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#89A88D]" />
              <span className="text-[#89A88D] text-[11px]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-[11px]">Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-4 overflow-x-auto font-mono text-xs md:text-sm text-[var(--text-main)] leading-relaxed">
        <pre>{value}</pre>
      </div>
    </div>
  );
};

const MarkdownRenderer = ({ content, onCitationClick }) => {
  if (!content) return null;

  const sanitizedContent = (content || '')
    .replace(/<shiro_ui>[\s\S]*?<\/shiro_ui>/gi, '')
    .replace(/<(?:think|thought)>[\s\S]*?<\/(?:think|thought)>/gi, '')
    .trim();

  if (!sanitizedContent) return null;

  // Render citation pills [CIT-n] or [n]
  const renderTextWithCitations = (children) => {
    if (typeof children !== 'string') return children;

    const citationRegex = /\[(CIT-\d+|\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(children)) !== null) {
      if (match.index > lastIndex) {
        parts.push(children.substring(lastIndex, match.index));
      }

      const citId = match[1];
      parts.push(
        <button
          key={`cit-${match.index}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onCitationClick) onCitationClick(citId);
          }}
          className="citation-pill"
          title={`View source evidence for ${citId}`}
        >
          <span>[{citId}]</span>
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < children.length) {
      parts.push(children.substring(lastIndex));
    }

    return parts.length > 0 ? parts : children;
  };

  return (
    <div className="prose max-w-none text-[var(--text-main)] text-sm md:text-base leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const value = String(children).replace(/\n$/, "");

            if (!inline && match) {
              return <CodeBlock language={match[1]} value={value} />;
            }
            if (!inline && value.includes("\n")) {
              return <CodeBlock language="text" value={value} />;
            }
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] font-mono text-[13px]"
                {...props}
              >
                {children}
              </code>
            );
          },
          p({ children }) {
            return <p className="mb-3">{renderTextWithCitations(children)}</p>;
          },
          li({ children }) {
            return <li className="mb-1">{renderTextWithCitations(children)}</li>;
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <table className="w-full text-left text-xs md:text-sm border-collapse">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-b border-[var(--border)]">{children}</thead>;
          },
          th({ children }) {
            return <th className="p-3 font-semibold text-xs tracking-wider uppercase text-[var(--text-secondary)]">{children}</th>;
          },
          td({ children }) {
            return <td className="p-3 border-b border-[var(--border)] text-[var(--text-secondary)]">{children}</td>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 pl-4 border-l-3 border-[#3F6048] dark:border-[#89A88D] text-[var(--text-main)] italic font-serif text-base bg-[#E8EFE9]/30 dark:bg-[#89A88D]/5 py-3 pr-4 rounded-r-xl leading-relaxed">
                {children}
              </blockquote>
            );
          },
          h1: ({ children }) => <h1 className="text-xl md:text-2xl font-bold text-[var(--text-main)] font-serif mt-6 mb-3 tracking-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg md:text-xl font-bold text-[var(--text-main)] font-serif mt-5 mb-2.5 tracking-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base md:text-lg font-bold text-[#3F6048] dark:text-[#89A88D] mt-4 mb-2">{children}</h3>,
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
