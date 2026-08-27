import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CheckCircle2, Bookmark, ExternalLink, Sparkles } from 'lucide-react';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

export const CitationDrawer = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Slide-over Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-lg bg-[var(--bg-surface)] border-l border-[var(--border)] shadow-2xl z-10 flex flex-col h-full overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-surface-elevated)]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#3F6048]/10 dark:bg-[#89A88D]/15 border border-[#3F6048]/20 dark:border-[#89A88D]/30 text-[#3F6048] dark:text-[#89A88D]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text-main)] text-sm md:text-base flex items-center gap-2 font-serif">
                  Verified Source Evidence
                  <Badge variant="sage" size="sm">
                    {citation.id || 'Citation'}
                  </Badge>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-[280px]">
                  {citation.filename || 'Document Source'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Metadata Chips */}
          <div className="px-5 py-3 bg-[var(--bg-surface-elevated)]/60 border-b border-[var(--border)] flex flex-wrap gap-2 items-center text-xs">
            <Badge variant="slate" size="sm">
              Page {citation.page_number || 1}
            </Badge>
            {citation.document_version && (
              <Badge variant="sage" size="sm">
                v{citation.document_version}
              </Badge>
            )}
            {citation.rrf_score && (
              <Badge variant="emerald" size="sm">
                Match: {(citation.rrf_score * 100).toFixed(1)}%
              </Badge>
            )}
            {citation.chunk_id && (
              <span className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-[140px]">
                ID: {citation.chunk_id}
              </span>
            )}
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm leading-relaxed text-[var(--text-secondary)] custom-scroll">
            <div className="p-4 rounded-xl bg-[#E8EFE9]/40 dark:bg-[#89A88D]/10 border border-[#3F6048]/20 dark:border-[#89A88D]/30">
              <div className="flex items-center gap-2 text-[#3F6048] dark:text-[#A8C5AC] font-medium text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Exact Grounded Source Context
              </div>
              <p className="font-mono text-xs text-[var(--text-main)] whitespace-pre-wrap leading-relaxed">
                "{citation.content || 'No text snippet available.'}"
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-2">
              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Grounding & Provenance
              </h4>
              <p className="text-xs text-[var(--text-muted)]">
                Shiro AI retrieved this context using Hybrid Dense + BM25 Lexical search with Reciprocal Rank Fusion to ensure zero-hallucination factual grounding.
              </p>
            </div>
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface-elevated)] flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(citation.content || '');
                onClose();
              }}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Copy Excerpt
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CitationDrawer;
