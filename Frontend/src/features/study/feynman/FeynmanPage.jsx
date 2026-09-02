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
  Layers,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Check,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Edit3,
  Volume2,
  VolumeX
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import MarkdownRenderer from '../../chat/components/MarkdownRenderer';

const CHALLENGE_TYPES = [
  { id: 'auto', label: '🎲 Auto-Mix', desc: 'Shiro picks the best angle' },
  { id: 'why', label: '🎯 Why It Matters', desc: 'Core purpose & consequences' },
  { id: 'how', label: '⚙️ How It Works', desc: 'Step-by-step causal mechanism' },
  { id: 'teach', label: '🧑‍🏫 Teach a 12yo', desc: 'Relatable everyday analogy' },
  { id: 'compare', label: '⚖️ Compare & Contrast', desc: 'Distinguish from confusing ideas' },
  { id: 'apply', label: '💡 Real Scenario', desc: 'Apply to a practical situation' },
  { id: 'misconception', label: '⚠️ Challenge Myth', desc: 'Dissect a flawed intuition' },
];

export const FeynmanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Document & Concept Selection State
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || '');
  const [availableConcepts, setAvailableConcepts] = useState([]);
  const [selectedConceptChoice, setSelectedConceptChoice] = useState('ai_pick');
  const [customConcept, setCustomConcept] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState('auto');
  const [loadingConcepts, setLoadingConcepts] = useState(false);

  // Active Challenge State
  const [challengeData, setChallengeData] = useState(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  // Follow-up & Loop State
  const [activeFollowUp, setActiveFollowUp] = useState(null);
  const [attemptCount, setAttemptCount] = useState(1);

  // Voice Recognition Refs & State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchDocuments();
  }, [user]);

  // When selected document changes, fetch available concepts
  useEffect(() => {
    if (selectedDocId) {
      fetchConceptsForDoc(selectedDocId);
    }
  }, [selectedDocId]);

  // Audio Critique State
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  // Clean up speech recognition & audio on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (e) {}
      }
    };
  }, []);

  const playEvaluationAudio = async () => {
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }

    if (!evaluation?.feedback) return;

    setAudioLoading(true);
    try {
      const critiqueText = `${evaluation.verdict || ''}. ${evaluation.feedback}`.trim();
      const response = await fetchWithAuth(`${API_BASE_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: critiqueText, lang: 'en' })
      });

      if (!response.ok) throw new Error('Speech synthesis failed');

      const data = await response.json();
      if (data.url) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(data.url);
        audioRef.current = audio;
        audio.onended = () => setAudioPlaying(false);
        audio.onerror = () => setAudioPlaying(false);
        await audio.play();
        setAudioPlaying(true);
      }
    } catch (err) {
      console.error('TTS playback error:', err);
      toast.error('Could not play audio critique.');
    } finally {
      setAudioLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDocId) {
          const initialId = location.state?.documentId || data[0].id;
          setSelectedDocId(initialId);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchConceptsForDoc = async (docId) => {
    setLoadingConcepts(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/concepts?document_id=${docId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableConcepts(data || []);
      } else {
        setAvailableConcepts([]);
      }
    } catch (err) {
      console.error('Error fetching concepts:', err);
      setAvailableConcepts([]);
    } finally {
      setLoadingConcepts(false);
    }
  };

  // Start / Generate a new Feynman Challenge
  const startChallenge = async (customConceptOverride = null) => {
    if (!selectedDocId) {
      toast.error('Please select a document first.');
      return;
    }

    setLoading(true);
    setChallengeData(null);
    setEvaluation(null);
    setActiveFollowUp(null);
    setShowHint(false);
    setExplanation('');
    setAttemptCount(1);

    // Determine target concept name
    let targetConcept = customConceptOverride;
    if (!targetConcept) {
      if (selectedConceptChoice === 'custom') {
        targetConcept = customConcept.trim();
        if (!targetConcept) {
          toast.error('Please type a custom concept name or select one from the list.');
          setLoading(false);
          return;
        }
      } else if (selectedConceptChoice !== 'ai_pick') {
        targetConcept = selectedConceptChoice;
      }
    }

    try {
      const formData = new FormData();
      formData.append('document_ids', JSON.stringify([parseInt(selectedDocId)]));
      if (targetConcept && targetConcept !== 'ai_pick') {
        formData.append('concept_name', targetConcept);
      }
      if (selectedArchetype && selectedArchetype !== 'auto') {
        formData.append('challenge_type', selectedArchetype);
      }

      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/challenge`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to generate Feynman challenge');

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setChallengeData(data);
      toast.success('Challenge generated! Teach it simply in your own words.');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit Student's Explanation
  const submitExplanation = async () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }

    if (!explanation.trim()) {
      toast.error('Please teach the concept in your own words first.');
      return;
    }

    setEvaluating(true);
    try {
      const formData = new FormData();
      formData.append('concept_name', challengeData?.concept_name || 'Concept');
      formData.append('explanation', explanation);
      if (challengeData?.challenge_title) {
        formData.append('challenge_title', challengeData.challenge_title);
      }
      if (challengeData?.challenge_prompt) {
        formData.append('challenge_prompt', challengeData.challenge_prompt);
      }
      if (activeFollowUp) {
        formData.append('previous_gaps', JSON.stringify(evaluation?.missing_links || []));
      }

      const response = await fetchWithAuth(`${API_BASE_URL}/feynman/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Evaluation failed');

      const data = await response.json();
      setEvaluation(data);
      toast.success('Evaluation complete! Inspect your conceptual diagnosis below.');
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  // Begin Follow-Up Challenge (Completes the Feynman Loop!)
  const handleFollowUpLoop = () => {
    if (!evaluation?.follow_up_question) return;
    setActiveFollowUp(evaluation.follow_up_question);
    setAttemptCount(prev => prev + 1);
    setExplanation('');
    toast('Follow-up loaded! Refine your explanation to close the gap.', { icon: '🎯' });
    // Scroll smoothly to teaching box
    const teachingBox = document.getElementById('feynman-teaching-box');
    if (teachingBox) {
      teachingBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Continuous Native Speech Recognition
  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        isRecordingRef.current = true;
      };

      recognition.onresult = (event) => {
        let newTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const phrase = event.results[i][0]?.transcript || '';
          if (phrase) {
            newTranscript += (newTranscript ? ' ' : '') + phrase.trim();
          }
        }
        if (newTranscript) {
          setExplanation(prev => (prev ? `${prev} ${newTranscript}` : newTranscript));
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed') {
          isRecordingRef.current = false;
          setIsRecording(false);
          toast.error('Microphone permission denied.');
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) {
              try { recognition.start(); } catch (e) {}
            }
          }, 200);
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      recognition.start();
    } catch (e) {
      console.error('Speech recognition start failed:', e);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const selectedDoc = documents.find(d => String(d.id) === String(selectedDocId));

  return (
    <div className="p-3.5 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-[#3F6048] dark:text-[#89A88D] font-mono uppercase tracking-wider">
          <BrainCircuit className="w-4 h-4" />
          <span>THE FEYNMAN TECHNIQUE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
          The Feynman Challenge
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          The ultimate test of comprehension: reconstruct and teach an idea from memory in simple language.
          Find your gaps, strip away textbook jargon, and prove true mastery.
        </p>
      </div>

      {/* Setup Panel: Document, Concept & Challenge Archetype Selection */}
      <Card className="p-4 sm:p-5 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Document Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
              Source Material:
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs sm:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] font-medium"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          </div>

          {/* Concept Choice Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
              Concept to Teach:
            </label>
            <select
              value={selectedConceptChoice}
              onChange={(e) => setSelectedConceptChoice(e.target.value)}
              className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs sm:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] font-medium"
            >
              <option value="ai_pick">✨ Let Shiro Choose (Surprise Me)</option>
              {availableConcepts.map((c, idx) => (
                <option key={c.id || idx} value={c.name}>
                  📚 {c.name}
                </option>
              ))}
              <option value="custom">✍️ Custom Topic (Enter your own)...</option>
            </select>
          </div>
        </div>

        {/* Custom Concept Input Row (conditional) */}
        {selectedConceptChoice === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            className="pt-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customConcept}
                onChange={(e) => setCustomConcept(e.target.value)}
                placeholder="e.g. Author's Purpose, Heisenbergs Uncertainty Principle, Binary Search Trees..."
                className="flex-1 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#3F6048]"
              />
            </div>
          </motion.div>
        )}

        {/* Challenge Archetype Chips */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Challenge Angle:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {CHALLENGE_TYPES.map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedArchetype(type.id)}
                title={type.desc}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedArchetype === type.id
                    ? 'bg-[#3F6048] text-white border-[#3F6048] shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <Button 
            variant="primary" 
            size="md" 
            onClick={() => startChallenge()} 
            disabled={loading || !selectedDocId}
            className="w-full sm:w-auto justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Synthesizing Challenge...' : 'Generate Feynman Challenge'}</span>
          </Button>
        </div>
      </Card>

      {/* Active Challenge Experience */}
      {challengeData ? (
        <div className="space-y-6">
          {/* Today's Challenge Card */}
          <Card className="p-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 bg-[var(--bg-surface)] shadow-md space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Badge variant="sage" size="sm">
                  Today's Challenge
                </Badge>
                <span className="text-[11px] text-[var(--text-muted)] font-mono font-semibold">
                  Attempt #{attemptCount}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
                <BookOpen className="w-3.5 h-3.5 text-[#3F6048]" />
                <span className="truncate max-w-[200px]">{challengeData.document_name || selectedDoc?.filename}</span>
              </div>
            </div>

            {/* If actively in a Socratic Follow-Up loop, highlight the targeted challenge! */}
            {activeFollowUp ? (
              <div className="p-4 rounded-xl bg-[#89A88D]/15 border border-[#89A88D]/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#3F6048] dark:text-[#89A88D]">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>Socratic Follow-Up Challenge (Closing Your Gap):</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif leading-snug">
                  "{activeFollowUp}"
                </h3>
              </div>
            ) : (
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] font-serif leading-snug">
                  {challengeData.challenge_title}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2 leading-relaxed font-medium">
                  {challengeData.challenge_prompt}
                </p>
              </div>
            )}

            {/* Subtle Collapsible Hint (Never gives away the answer too early!) */}
            {challengeData.hint && (
              <div className="pt-1">
                <button
                  onClick={() => setShowHint(!showHint)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#89A88D] flex items-center gap-1.5 transition-colors font-medium"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-[#D6A84F]" />
                  <span>{showHint ? 'Hide guidance hint' : 'Need a gentle hint?'}</span>
                  {showHint ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                <AnimatePresence>
                  {showHint && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2.5 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] leading-relaxed italic"
                    >
                      💡 {challengeData.hint}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </Card>

          {/* Student's Teaching Box */}
          <div id="feynman-teaching-box" className="glass-panel p-4 sm:p-5 space-y-3.5 bg-[var(--bg-surface)] border-[var(--border)] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs sm:text-sm font-bold text-[var(--text-main)] flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#3F6048]" />
                  Your Teaching:
                </span>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Don't memorize definitions. Speak or write as if explaining to a curious beginner.
                </p>
              </div>

              {/* Voice Entry Button */}
              <button
                onClick={toggleVoice}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                  isRecording
                    ? 'bg-[#C96B62]/20 border-[#C96B62] text-[#C96B62] animate-pulse shadow-sm'
                    : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#3F6048]'
                }`}
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Listening (Continuous)...' : 'Explain by Voice'}</span>
              </button>
            </div>

            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Start teaching in your own words... (e.g. 'Imagine you are explaining this to a friend over coffee...')"
              rows={7}
              disabled={evaluating}
              className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-4 text-xs sm:text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#3F6048] custom-scroll leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                {explanation.trim() ? `${explanation.trim().split(/\s+/).length} words` : 'Empty'}
              </span>

              <Button
                variant="primary"
                size="md"
                onClick={submitExplanation}
                disabled={evaluating || !explanation.trim()}
                className="gap-2"
              >
                {evaluating ? (
                  <div className="w-4 h-4 border-2 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Submit Teaching for Analysis</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Diagnostic Evaluation Results Card */}
          {evaluation && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-5 sm:p-6 space-y-6 border-[#3F6048]/30 bg-[var(--bg-surface)] shadow-md"
            >
              {/* Verdict Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    evaluation.overall_score >= 80
                      ? 'bg-[#3F6048]/15 border-[#3F6048]/40 text-[#3F6048] dark:text-[#89A88D]'
                      : 'bg-[#D6A84F]/15 border-[#D6A84F]/40 text-[#D6A84F]'
                  }`}>
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-[var(--text-main)] font-serif">
                        Mastery Index: {evaluation.overall_score || evaluation.score}%
                      </h3>
                      <Badge variant={evaluation.overall_score >= 80 ? 'sage' : 'gold'} size="sm">
                        {evaluation.overall_score >= 80 ? '🟢 Strong Foundation' : '🟡 One Important Gap'}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {evaluation.verdict || (evaluation.overall_score >= 80 ? 'Excellent intuitive grasp!' : 'Good effort. Close the missing link below.')}
                    </p>
                  </div>
                </div>

                <Button variant="outline" size="sm" onClick={() => navigate('/flashcards')} className="self-start sm:self-auto gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Review in Flashcards</span>
                </Button>
              </div>

              {/* 5-Dimension Diagnostic Meters */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono">
                  Educational Diagnostic Breakdown:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Understanding', score: evaluation.understanding_score ?? 75, desc: 'Conceptual mental model' },
                    { label: 'Clarity', score: evaluation.clarity_score ?? 80, desc: 'Simplicity for a beginner' },
                    { label: 'Completeness', score: evaluation.completeness_score ?? 65, desc: 'Causal mechanisms covered' },
                    { label: 'Jargon-Free', score: evaluation.jargon_free_score ?? 90, desc: 'Intuitive plain language' },
                    { label: 'Logical Reasoning', score: evaluation.reasoning_score ?? 70, desc: 'Sound causal progression' },
                  ].map((dim, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[var(--text-main)]">{dim.label}</span>
                        <span className={`font-mono font-bold ${
                          dim.score >= 80 ? 'text-[#3F6048] dark:text-[#89A88D]' : dim.score >= 60 ? 'text-[#D6A84F]' : 'text-[#C96B62]'
                        }`}>{dim.score}%</span>
                      </div>
                      <div className="w-full bg-[var(--bg-main)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            dim.score >= 80 ? 'bg-[#3F6048] dark:bg-[#89A88D]' : dim.score >= 60 ? 'bg-[#D6A84F]' : 'bg-[#C96B62]'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, dim.score))}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)]">{dim.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* What You Understood (Strengths) */}
              {evaluation.strengths && evaluation.strengths.length > 0 && (
                <div className="p-4 rounded-xl bg-[#3F6048]/10 border border-[#3F6048]/25 space-y-2">
                  <span className="text-xs font-bold text-[#3F6048] dark:text-[#89A88D] flex items-center gap-1.5 uppercase tracking-wider">
                    <Check className="w-3.5 h-3.5" />
                    What You Clearly Understood:
                  </span>
                  <ul className="space-y-1.5 text-xs text-[var(--text-main)] leading-relaxed">
                    {evaluation.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#3F6048] font-bold">✓</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Links / Conceptual Gaps */}
              {evaluation.missing_links && evaluation.missing_links.length > 0 && (
                <div className="p-4 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 space-y-2">
                  <span className="text-xs font-bold text-[#D6A84F] flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Missing Links & Conceptual Gaps:
                  </span>
                  <ul className="space-y-1.5 text-xs text-[var(--text-main)] leading-relaxed">
                    {evaluation.missing_links.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#D6A84F] font-bold">⚠</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Jargon Detected */}
              {evaluation.jargon_detected && evaluation.jargon_detected.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-[#D6A84F] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
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
                <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-main)] leading-relaxed space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Shiro's Observation:</span>
                    <button
                      type="button"
                      onClick={playEvaluationAudio}
                      disabled={audioLoading}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                        audioPlaying
                          ? 'bg-[#3F6048] text-white border-[#3F6048] animate-pulse shadow-sm'
                          : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#3F6048]'
                      }`}
                    >
                      {audioLoading ? (
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : audioPlaying ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                      )}
                      <span>{audioLoading ? 'Synthesizing...' : audioPlaying ? 'Pause Audio' : 'Listen to Critique'}</span>
                    </button>
                  </div>
                  <MarkdownRenderer content={evaluation.feedback} />
                </div>
              )}

              {/* The Socratic Follow-Up Challenge: Completing the Loop! */}
              {evaluation.follow_up_question && (
                <div className="p-5 rounded-2xl bg-[#3F6048]/15 border border-[#3F6048]/35 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3F6048] dark:text-[#89A88D] flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" />
                      Shiro's Targeted Follow-Up Challenge:
                    </span>
                    <Badge variant="sage" size="sm">Next Step</Badge>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-[var(--text-main)] font-serif leading-snug">
                    "{evaluation.follow_up_question}"
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Answer this targeted question directly to close your detected gap and prove full conceptual mastery.
                  </p>
                  <div className="pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleFollowUpLoop}
                      className="gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Refine Explanation with Follow-Up</span>
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 text-center space-y-4 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <BrainCircuit className="w-12 h-12 text-[#3F6048] dark:text-[#89A88D] mx-auto opacity-40" />
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)] font-serif">Ready for the Feynman Challenge?</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mt-1">
              Select your source material, pick a concept (or let Shiro surprise you), and click "Generate Feynman Challenge".
            </p>
          </div>
          <Button variant="primary" size="md" onClick={() => startChallenge()} disabled={loading || !selectedDocId}>
            <Sparkles className="w-4 h-4" />
            <span>Generate First Challenge</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default FeynmanPage;
