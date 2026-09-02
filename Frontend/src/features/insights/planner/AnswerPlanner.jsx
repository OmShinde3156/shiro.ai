import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  CheckCircle2, 
  ListOrdered, 
  FileText, 
  Send, 
  Award, 
  Info, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowRight, 
  HelpCircle, 
  Layers, 
  ShieldCheck, 
  Target, 
  Zap 
} from 'lucide-react';
import API_BASE_URL from '../../../api/config';
import { useAuth } from '../../../context/AuthContext';
import { Context } from '../../../context/Context';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Tooltip from '../../../components/ui/Tooltip';
import MarkdownRenderer from '../../chat/components/MarkdownRenderer';

export const AnswerPlanner = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments: refreshDocs, t } = useContext(Context);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('answer'); // 'plan' | 'answer' | 'verification'
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    question: '',
    marks: 5,
    document_id: '',
    answer_type: 'descriptive',
    subject: 'General'
  });

  useEffect(() => {
    if (user?.id) {
      refreshDocs(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (documents.length > 0 && !formData.document_id) {
      setFormData(prev => ({ ...prev, document_id: documents[0].id }));
    }
  }, [documents]);

  const handlePresetClick = (preset) => {
    setFormData(prev => ({
      ...prev,
      question: preset.q,
      marks: preset.marks,
      subject: preset.subject
    }));
  };

  const handleCopy = () => {
    if (!result?.final_answer) return;
    navigator.clipboard.writeText(result.final_answer);
    setCopied(true);
    toast.success('Model answer copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.question.trim() || !formData.document_id) {
      toast.error("Please enter a question and select source material");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/features/answer-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setActiveTab('answer');
        toast.success("✨ Exam answer blueprint synthesized!");
      } else {
        const err = await res.json();
        toast.error(err.detail || "Generation failed");
      }
    } catch (err) {
      toast.error("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const targetWordCount = formData.marks * 35;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* 1. Header Toolbar */}
      <div className="w-full px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#89A88D] mb-1">
            <Target className="w-3.5 h-3.5" />
            <span>EXAM SCORING ARCHITECT</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] font-serif">
            Answer Planner & Truth Verifier
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="sage" size="md" icon={ShieldCheck}>
            3-Stage Truth RAG
          </Badge>
        </div>
      </div>

      {/* 2. Main Content Viewport (Scrollbar on Right Edge) */}
      <div className="flex-1 w-full overflow-y-auto custom-scroll">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Left Panel: Question Builder */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-[var(--border)]">
                <CardHeader
                  title="Answer Configuration"
                  subtitle="Structure exam answers according to marks and source materials"
                  icon={Sparkles}
                />
                <CardContent className="space-y-4 pt-2">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Select Document */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-main)]">
                        Source Document (Truth Anchor)
                      </label>
                      <select 
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                        value={formData.document_id}
                        onChange={(e) => setFormData({...formData, document_id: e.target.value})}
                      >
                        <option value="">Select source note...</option>
                        {documents.map(doc => (
                          <option key={doc.id} value={doc.id}>
                            {doc.filename} ({doc.subject || 'General'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Question Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-main)]">
                        Exam Question
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="e.g. Explain the mechanism of gradient descent optimization and discuss local minima."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[#89A88D] resize-none leading-relaxed"
                        value={formData.question}
                        onChange={(e) => setFormData({...formData, question: e.target.value})}
                      />
                    </div>

                    {/* Marks & Subject Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)]">
                          Target Marks
                        </label>
                        <select
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                          value={formData.marks}
                          onChange={(e) => setFormData({...formData, marks: parseInt(e.target.value, 10) || 5})}
                        >
                          <option value={2}>2 Marks (Short Definition)</option>
                          <option value={5}>5 Marks (Standard Concept)</option>
                          <option value={10}>10 Marks (Detailed Essay)</option>
                          <option value={15}>15 Marks (Comprehensive Analysis)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)]">
                          Subject Area
                        </label>
                        <input 
                          type="text"
                          placeholder="e.g. Machine Learning"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[#89A88D]"
                          value={formData.subject}
                          onChange={(e) => setFormData({...formData, subject: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* Word Budget Indicator */}
                    <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">Target Word Budget:</span>
                      <span className="font-mono font-bold text-[#89A88D]">~{targetWordCount} words</span>
                    </div>

                    {/* Submit Button */}
                    <Button 
                      disabled={loading || !formData.question.trim()}
                      type="submit"
                      variant="primary"
                      size="md"
                      className="w-full"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Synthesizing Multi-Stage Blueprint...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span>Generate Model Response</span>
                        </div>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Instant Question Presets */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                  High-Yield Question Templates
                </span>
                <div className="space-y-1.5">
                  {[
                    { q: "Explain the architectural difference between Convolutional and Recurrent neural networks.", marks: 5, subject: "Deep Learning" },
                    { q: "Derive the fundamental principles and thermodynamic efficiency of the Carnot Cycle.", marks: 10, subject: "Physics" },
                    { q: "Analyze the doctrine of Separation of Powers with historical legal precedents.", marks: 10, subject: "Constitutional Law" },
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePresetClick(item)}
                      className="w-full p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[#89A88D]/40 text-left transition-all text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center justify-between group"
                    >
                      <span className="truncate max-w-[85%]">{item.q}</span>
                      <Badge variant="stone" size="sm">
                        {item.marks}M
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: 3-Stage Blueprint Output */}
            <div className="lg:col-span-7 space-y-4">
              {!result && !loading && (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center justify-center text-[#89A88D]">
                    <FileText className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--text-main)] font-serif">
                    Awaiting Question Prompt
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm">
                    Enter any exam question to generate a structural blueprint, gold-standard model answer, and fact-verified rubric.
                  </p>
                </div>
              )}

              {loading && (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3 animate-pulse">
                      <div className="h-4 w-1/3 bg-[var(--bg-surface-elevated)] rounded-md" />
                      <div className="h-3 w-full bg-[var(--bg-surface-elevated)] rounded-md" />
                      <div className="h-3 w-2/3 bg-[var(--bg-surface-elevated)] rounded-md" />
                    </div>
                  ))}
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  {/* View Tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] overflow-x-auto no-scrollbar touch-scroll">
                    {[
                      { id: 'plan', label: '1. Scoring Blueprint', icon: ListOrdered },
                      { id: 'answer', label: '2. Model Answer', icon: FileText },
                      { id: 'verification', label: '3. Fact Verification', icon: ShieldCheck },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                            isActive
                              ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab Body */}
                  <Card className="border-[var(--border)] min-h-[420px]">
                    <CardContent className="p-6">
                      {/* TAB 1: SCORING BLUEPRINT */}
                      {activeTab === 'plan' && result.plan && (
                        <div className="space-y-6">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#89A88D] block mb-1">
                              Introduction Strategy
                            </span>
                            <p className="text-sm text-[var(--text-main)] leading-relaxed bg-[var(--bg-surface-elevated)] p-3.5 rounded-xl border border-[var(--border)]">
                              {result.plan.intro}
                            </p>
                          </div>

                          <div className="space-y-3">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">
                              Core Points & Marks Allocation
                            </span>
                            <div className="space-y-2">
                              {result.plan.points?.map((p, i) => (
                                <div 
                                  key={i} 
                                  className="flex items-start gap-3 p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)]"
                                >
                                  <span className="w-6 h-6 rounded-lg bg-[#89A88D]/20 text-[#89A88D] flex items-center justify-center text-xs font-bold shrink-0">
                                    {i + 1}
                                  </span>
                                  <div className="flex-1 space-y-1">
                                    <p className="text-xs text-[var(--text-main)] leading-relaxed">{p.text}</p>
                                    <div className="flex items-center gap-2">
                                      <Badge variant={p.importance === 'high' ? 'rose' : 'sage'} size="sm">
                                        Priority: {p.importance || 'high'}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {result.plan.example && (
                            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-[#D6A84F] block">
                                Worked Example / Precedent Case
                              </span>
                              <p className="text-xs text-[var(--text-secondary)] italic">
                                {result.plan.example}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: MODEL EXAM ANSWER */}
                      {activeTab === 'answer' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                            <div className="flex items-center gap-2">
                              <Badge variant="sage" size="md">
                                {result.marks} Marks Target
                              </Badge>
                              <span className="text-xs text-[var(--text-muted)] font-mono">
                                Verified by Truth-Aware RAG
                              </span>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              icon={copied ? Check : Copy}
                              onClick={handleCopy}
                            >
                              {copied ? 'Copied' : 'Copy Answer'}
                            </Button>
                          </div>

                          <div className="prose max-w-none text-[var(--text-main)] text-sm leading-relaxed">
                            <MarkdownRenderer content={result.final_answer} />
                          </div>
                        </div>
                      )}

                      {/* TAB 3: TRUTH FACT VERIFICATION */}
                      {activeTab === 'verification' && (
                        <div className="space-y-6">
                          {/* Top Confidence Banner */}
                          <div className="p-4 rounded-xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[#89A88D] text-black flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-[var(--text-main)]">
                                RAG Grounding Confidence: {(result.confidence * 100).toFixed(1)}%
                              </h4>
                              <p className="text-xs text-[var(--text-secondary)]">
                                Verified claim-by-claim against source document.
                              </p>
                            </div>
                          </div>

                          {/* Verification Claims Feed */}
                          <div className="space-y-2.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                              Chain of Evidence Claims
                            </span>
                            {result.verification?.map((v, i) => (
                              <div 
                                key={i} 
                                className={`p-3.5 rounded-xl border space-y-1.5 ${
                                  v.is_verified 
                                    ? 'bg-[var(--bg-surface-elevated)] border-[var(--border)]' 
                                    : 'bg-[#C96B62]/10 border-[#C96B62]/30'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${v.is_verified ? 'bg-[#89A88D]' : 'bg-[#C96B62]'}`} />
                                  <span className="text-xs font-semibold text-[var(--text-main)] font-mono">
                                    Claim #{i + 1}
                                  </span>
                                  {v.is_verified ? (
                                    <Badge variant="sage" size="sm">Ground Truth Match</Badge>
                                  ) : (
                                    <Badge variant="rose" size="sm">Unverified Assumption</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--text-main)]">{v.claim}</p>
                                {v.reason && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                    <Info className="w-3 h-3 text-[#89A88D]" />
                                    <span>{v.reason}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AnswerPlanner;
