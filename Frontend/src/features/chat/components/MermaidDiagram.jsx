import React, { useEffect, useRef, useState } from "react";
import { Download, Copy, Check, Eye, Code, Sparkles, RefreshCw } from "lucide-react";

// Singleton loader to ensure Mermaid ESM is downloaded at most ONCE, on-demand
let mermaidInstancePromise = null;

const getMermaid = () => {
  if (!mermaidInstancePromise) {
    mermaidInstancePromise = (async () => {
      try {
        // Dynamic import from CDN: Zero bundle size overhead on initial page load!
        const module = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs");
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          flowchart: {
            curve: "basis",
            useMaxWidth: true,
            htmlLabels: true
          }
        });
        return mermaid;
      } catch (err) {
        console.warn("Could not load Mermaid from CDN (possibly offline):", err);
        return null;
      }
    })();
  }
  return mermaidInstancePromise;
};

export const MermaidDiagram = ({ chart }) => {
  const containerRef = useRef(null);
  const [svgHtml, setSvgHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [viewCode, setViewCode] = useState(false);

  const cleanChart = (chart || "").trim();

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      if (!cleanChart) return;
      setLoading(true);
      setError(null);

      try {
        const mermaid = await getMermaid();
        if (!mermaid) {
          throw new Error("Mermaid library unavailable (offline or CDN blocked)");
        }

        const uniqueId = `mermaid-svg-${Math.random().toString(36).slice(2, 10)}`;
        const { svg } = await mermaid.render(uniqueId, cleanChart);

        if (isMounted) {
          setSvgHtml(svg);
          setLoading(false);
        }
      } catch (err) {
        console.warn("Mermaid rendering fallback:", err);
        if (isMounted) {
          setError(err.message || "Failed to render diagram");
          setLoading(false);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [cleanChart]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanChart);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shiro-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] overflow-hidden shadow-xs">
      {/* Diagram Card Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)] text-xs text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#89A88D] animate-pulse" />
          <span className="font-semibold text-[var(--text-main)] font-serif">Visual Architecture & Flow</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider hidden sm:inline">
            · Exam Diagram
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewCode(!viewCode)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors flex items-center gap-1 text-[11px]"
            title={viewCode ? "View Visual Diagram" : "View Diagram Source Code"}
          >
            {viewCode ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{viewCode ? "Visual" : "Code"}</span>
          </button>

          {svgHtml && !viewCode && (
            <button
              onClick={handleDownloadSvg}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
              title="Download SVG Vector Diagram"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors"
            title="Copy Diagram Syntax"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#89A88D]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Diagram Canvas Body */}
      <div className="p-4 sm:p-6 overflow-x-auto min-h-[140px] flex items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] py-6 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-[#89A88D]" />
            <span>Rendering visual diagram...</span>
          </div>
        ) : viewCode || error ? (
          <div className="w-full text-left space-y-2">
            {error && (
              <p className="text-[11px] text-[#D6A84F] font-mono">
                ℹ️ Diagram source (Rendered in Exam Sketch format):
              </p>
            )}
            <pre className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-xs text-[var(--text-main)] overflow-x-auto leading-relaxed whitespace-pre">
              {cleanChart}
            </pre>
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:rounded-xl [&_svg]:transition-all select-none"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        )}
      </div>

      {/* Pen-and-Paper Exam Tip Footer */}
      <div className="px-4 py-2 bg-[var(--bg-surface)]/60 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] flex items-center justify-between">
        <span>✍️ Exam Tip: Replicate this flowchart on your answer sheet for full diagram marks.</span>
      </div>
    </div>
  );
};

export default MermaidDiagram;
