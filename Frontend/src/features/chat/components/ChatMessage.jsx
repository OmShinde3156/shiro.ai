import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  User as UserIcon, 
  Copy, 
  Check, 
  RotateCw, 
  BrainCircuit, 
  HelpCircle, 
  Layers, 
  Sparkles, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Network,
  ArrowRight
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

// Helper to sanitize text and extract UI action cards if present
const parseMessagePayload = (rawText, suggestedAction) => {
  if (!rawText) return { cleanText: '', actionCard: null };

  let cleanText = rawText;
  let actionCard = null;

  // Extract <shiro_ui>...</shiro_ui>
  const uiRegex = /<shiro_ui>([\s\S]*?)<\/shiro_ui>/i;
  const uiMatch = cleanText.match(uiRegex);
  if (uiMatch) {
    try {
      const parsed = JSON.parse(uiMatch[1].trim());
      actionCard = parsed.props || parsed;
    } catch (e) {
      console.warn("Failed to parse shiro_ui payload", e);
    }
    cleanText = cleanText.replace(uiRegex, '').trim();
  }

  // Fallback to backend suggested_action if not found inline
  if (!actionCard && suggestedAction) {
    actionCard = suggestedAction;
  }

  return { cleanText, actionCard };
};

export const ChatMessage = ({
  message,
  isLatest = false,
  onCitationClick,
  onRegenerate,
  onActionClick
}) => {
  const [copied, setCopied] = useState(false);
  const [showThought, setShowThought] = useState(false);

  const isUser = message.isUser;
  const { cleanText, actionCard } = parseMessagePayload(message.text, message.suggested_action);
  const thought = message.thought;
  const citations = message.citations || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanText || message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`w-full py-4 group ${
        isUser ? 'flex justify-end' : 'flex justify-start'
      }`}
    >
      <div className={`flex gap-3 max-w-3xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] shadow-xs">
              <UserIcon className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-[var(--bg-surface)] p-0.5 border border-[var(--border-strong)] flex items-center justify-center overflow-hidden shadow-xs">
              <img src="/logo.jpg" alt="Shiro AI" className="w-full h-full object-cover rounded-full" />
            </div>
          )}
        </div>

        {/* Message Bubble & Content Container */}
        <div className={`flex-1 min-w-0 space-y-2.5 ${isUser ? 'items-end text-right' : 'items-start text-left'}`}>
          {/* User Meta Row */}
          <div className={`flex items-center gap-2 text-xs font-semibold ${isUser ? 'justify-end text-[var(--text-secondary)]' : 'justify-start text-[var(--text-main)]'}`}>
            <span className="font-serif tracking-tight">{isUser ? 'You' : 'Shiro AI Tutor'}</span>
            {!isUser && (
              <Badge variant="sage" size="sm">
                Truth-Aware RAG
              </Badge>
            )}
          </div>

          {/* Core Message Text Body */}
          <div
            className={`p-4 rounded-2xl transition-all shadow-xs ${
              isUser
                ? 'bg-[var(--primary)] text-[var(--text-main)] rounded-tr-xs font-sans text-sm md:text-base leading-relaxed inline-block max-w-full text-left'
                : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-main)] rounded-tl-xs'
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{cleanText}</p>
            ) : message.isLoading && !cleanText ? (
              <div className="flex items-center gap-2.5 py-1 text-xs text-[var(--text-secondary)]">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse shrink-0" />
                <span className="font-mono text-[11px]">{message.statusText || "Generating answer..."}</span>
              </div>
            ) : (
              <MarkdownRenderer
                content={cleanText}
                onCitationClick={(citId) => {
                  const citObj = citations.find(c => String(c.id) === String(citId) || `CIT-${c.id}` === citId);
                  if (onCitationClick && citObj) {
                    onCitationClick(citObj);
                  } else if (onCitationClick) {
                    onCitationClick({ id: citId, content: `Referenced grounded excerpt [${citId}].` });
                  }
                }}
              />
            )}
          </div>

          {/* Embedded UI Action Cards (Next-Action Handoff to Quizzes, Flashcards, Feynman) */}
          {!isUser && actionCard && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]">
                    {actionCard.tool === 'quiz' && <HelpCircle className="w-4 h-4" />}
                    {actionCard.tool === 'flashcards' && <Layers className="w-4 h-4" />}
                    {actionCard.tool === 'feynman' && <Sparkles className="w-4 h-4" />}
                    {actionCard.tool === 'mindmap' && <Network className="w-4 h-4" />}
                    {(!actionCard.tool || actionCard.tool === 'study_plan') && <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-[var(--text-main)] font-serif">
                      {actionCard.title || 'Next Recommended Study Step'}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {actionCard.description || 'Launch targeted active recall from this explanation.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Trigger Button */}
              <Button
                variant="primary"
                size="sm"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => onActionClick && onActionClick(actionCard.tool || 'quiz', actionCard)}
              >
                <span>{actionCard.button_label || 'Launch Interactive Practice'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          )}

          {/* Citations Footer Shelf */}
          {!isUser && citations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider">Sources:</span>
              {citations.map((cit, idx) => (
                <button
                  key={idx}
                  onClick={() => onCitationClick && onCitationClick(cit)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all font-mono shadow-2xs"
                >
                  <FileText className="w-3 h-3 text-[var(--primary)]" />
                  <span>{cit.filename || `Doc ${idx + 1}`}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-sans">p.{cit.page_number || 1}</span>
                </button>
              ))}
            </div>
          )}

          {/* Message Actions Bar (Copy / Regenerate / Handoffs) */}
          {!isUser && (
            <div className="flex flex-col gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors flex items-center gap-1 text-[11px]"
                  title="Copy response"
                >
                  {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>

                {isLatest && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors flex items-center gap-1 text-[11px]"
                    title="Regenerate response"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
              
              {/* Study Action Handoffs (Only when contextually relevant) */}
              {(actionCard || (cleanText.length > 140 && !cleanText.startsWith('Hi!') && !cleanText.startsWith("You're welcome") && !cleanText.startsWith("Sounds good!"))) && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <button onClick={() => onActionClick && onActionClick('quiz', { tool: 'quiz', title: 'Quiz Me' })} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--primary-subtle)] text-[var(--primary-strong)] hover:bg-[var(--primary)] hover:text-white transition-colors border border-[var(--border)] flex items-center gap-1.5">
                    <HelpCircle className="w-3 h-3" /> Quiz Me
                  </button>
                  <button onClick={() => onActionClick && onActionClick('flashcards', { tool: 'flashcards', title: 'Make Flashcards' })} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--primary-subtle)] text-[var(--primary-strong)] hover:bg-[var(--primary)] hover:text-white transition-colors border border-[var(--border)] flex items-center gap-1.5">
                    <Layers className="w-3 h-3" /> Make Flashcards
                  </button>
                  <button onClick={() => onActionClick && onActionClick('feynman', { tool: 'feynman', title: 'Feynman Mode' })} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--ai-subtle)] text-[var(--ai)] hover:bg-[var(--ai)] hover:text-white transition-colors border border-[var(--ai-subtle)] flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Feynman Mode
                  </button>
                  <button onClick={() => onActionClick && onActionClick('mindmap', { tool: 'mindmap', title: 'Mind Map' })} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--primary-subtle)] text-[var(--primary-strong)] hover:bg-[var(--primary)] hover:text-white transition-colors border border-[var(--border)] flex items-center gap-1.5">
                    <Network className="w-3 h-3" /> Mind Map
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
