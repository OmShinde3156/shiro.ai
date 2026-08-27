import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import API_BASE_URL from '../../../api/config.js';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  BrainCircuit, 
  Mic, 
  MicOff, 
  Send, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  BookOpen, 
  ArrowRight,
  Layers
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import MarkdownRenderer from '../../chat/components/MarkdownRenderer';

export const FeynmanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || '');
  const [concept, setConcept] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  useEffect(() => {
    if (user?.id) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDocId) {
          setSelectedDocId(location.state?.documentId || data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const startChallenge = async () => {
    if (!selectedDocId) {
      toast.error('Please select a document first.');
      return;
    }
    setLoading(true);
    setConcept(null);
    setEvaluation(null);
    setExplanation('');

    try {
      const formData = new FormData();
      formData.append('user_id', user?.id || 1);
      formData.append('document_ids', JSON.stringify([parseInt(selectedDocId)]));

      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/challenge`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to generate challenge');

      const data = await response.json();
      setConcept(data.concept_name);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitExplanation = async () => {
    if (!explanation.trim()) {
      toast.error('Please write an explanation first.');
      return;
    }
    setEvaluating(true);
    try {
      const formData = new FormData();
      formData.append('user_id', user?.id || 1);
      formData.append('concept_name', concept);
      formData.append('explanation', explanation);

      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Evaluation failed');

      const data = await response.json();
      setEvaluation(data);
      toast.success('Evaluation complete!');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setExplanation(prev => `${prev} ${transcript}`.trim());
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3F6048] dark:text-[#89A88D] mb-1 font-mono uppercase tracking-wider">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>THE FEYNMAN TECHNIQUE</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Feynman Challenge Mode
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
            The ultimate test of understanding: explain a concept simply without jargon.
          </p>
        </div>

        {/* Document Selector & Trigger */}
        {documents?.length > 0 && (
          <div className="flex items-center gap-2 glass-panel p-2 bg-[var(--bg-surface)] border-[var(--border)]">
            <BookOpen className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D] shrink-0" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent border-0 text-xs md:text-sm text-[var(--text-main)] focus:outline-none font-medium cursor-pointer"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                  {d.filename}
                </option>
              ))}
            </select>
            <Button variant="primary" size="sm" onClick={startChallenge} disabled={loading}>
              <Sparkles className="w-3.5 h-3.5" />
              {loading ? 'Generating...' : 'New Challenge'}
            </Button>
          </div>
        )}
      </div>

      {/* Challenge Active Section */}
      {concept ? (
        <div className="space-y-6">
          {/* Concept Prompt Box */}
          <Card className="p-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 bg-[var(--bg-surface)] shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="sage" size="sm" className="mb-2">
                  Target Concept
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold text-[var(--text-main)] font-serif">
                  "{concept}"
                </h2>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                  Explain this concept as if you were teaching a student who has never encountered it before. Avoid unexplained technical jargon and focus on intuitive analogies!
                </p>
              </div>
            </div>
          </Card>

          {/* Explanation Textarea & Voice Input */}
          <div className="glass-panel p-4 space-y-3 bg-[var(--bg-surface)] border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-main)]">
                Your Explanation:
              </span>
              <button
                onClick={toggleVoice}
                className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all ${
                  isRecording
                    ? 'bg-[#C96B62]/20 border-[#C96B62] text-[#C96B62] animate-pulse'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Listening...' : 'Voice Entry'}</span>
              </button>
            </div>

            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Start explaining in your own words..."
              rows={6}
              disabled={evaluating}
              className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#89A88D] custom-scroll leading-relaxed"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={submitExplanation}
                disabled={evaluating || !explanation.trim()}
              >
                {evaluating ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Submit for Feynman Analysis</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Evaluation Results Card */}
          {evaluation && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 space-y-5 border-[#89A88D]/30 bg-[var(--bg-surface)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center justify-center text-[#89A88D]">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">
                      Understanding Score: {evaluation.score || 85}%
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {evaluation.score >= 80 ? 'Excellent intuitive grasp!' : 'Good effort. Address the gaps below.'}
                    </p>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => navigate('/flashcards')}>
                  <Layers className="w-3.5 h-3.5" />
                  Flashcards
                </Button>
              </div>

              {/* Jargon Badges */}
              {evaluation.jargon_detected && evaluation.jargon_detected.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6A84F] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Jargon Detected (Try replacing with simpler terms):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {evaluation.jargon_detected.map((jargon, idx) => (
                      <Badge key={idx} variant="gold" size="sm">
                        {jargon}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Summary */}
              {evaluation.feedback && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] leading-relaxed">
                  <MarkdownRenderer content={evaluation.feedback} />
                </div>
              )}

              {/* Socratic Follow-up Question */}
              {evaluation.follow_up_question && (
                <div className="p-4 rounded-xl bg-[#89A88D]/10 border border-[#89A88D]/25 space-y-1">
                  <span className="text-xs font-semibold text-[#89A88D] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Shiro Socratic Follow-Up:
                  </span>
                  <p className="text-xs md:text-sm text-[var(--text-main)] font-medium">
                    "{evaluation.follow_up_question}"
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center space-y-4 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <BrainCircuit className="w-12 h-12 text-[#3F6048] dark:text-[#89A88D] mx-auto opacity-40" />
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)] font-serif">No active Feynman challenge</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mt-1">
              Select a source document from your library and click "New Challenge" to have Shiro test your conceptual understanding.
            </p>
          </div>
          <Button variant="primary" size="md" onClick={startChallenge} disabled={loading || !selectedDocId}>
            <Sparkles className="w-4 h-4" />
            Start First Challenge
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeynmanPage;
