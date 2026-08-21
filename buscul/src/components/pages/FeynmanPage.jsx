import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import './FeynmanPage.css';
import { useXP } from '../../hooks/useXP';

const FeynmanPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { awardXP } = useXP();

  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");
  const [concept, setConcept] = useState(null);
  const [explanation, setExplanation] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (user?.id) fetchDocuments();
  }, [user]);

  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
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
    setExplanation("");

    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('document_ids', JSON.stringify([parseInt(selectedDocId)]));

      const response = await fetch(`${API_BASE_URL}/feynman/challenge`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to generate a challenge');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setConcept(data.concept_name);
      toast.success(`Challenge Started: ${data.concept_name}`);
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice recognition is not supported in this browser. Please type your explanation.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      // Only append final results or replace interim for a smoother experience
      // For simplicity, we'll append to the existing text
      setExplanation((prev) => {
          const newText = prev + " " + currentTranscript.trim();
          // removing duplicate continuous updates is tricky with raw SpeechRecognition without managing separate states,
          // so we just use final results if possible, but continuous interim gives immediate feedback.
          // Simplest is to just replace the last part or only use final. Let's use only final for cleaner text.
          return prev; 
      });
    };

    // Better approach for continuous speech input:
    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
             setExplanation((prev) => prev + finalTranscript);
        }
    };

    recognition.onerror = (event) => {
      console.error(event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    toast.success('Recording started. Speak your explanation!');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const submitExplanation = async () => {
    if (!explanation.trim()) {
      toast.error("Please provide an explanation.");
      return;
    }
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('concept_name', concept);
      formData.append('explanation', explanation);

      const response = await fetch(`${API_BASE_URL}/feynman/evaluate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
         throw new Error("Failed to evaluate explanation");
      }

      const data = await response.json();
      setEvaluation(data);
      
      // Award XP based on mastery score
      const xpToAward = Math.round((data.mastery_score || 0) / 2); // e.g. 80 mastery = 40 XP
      if (xpToAward > 0) {
        awardXP(xpToAward, `Feynman Mastery: ${concept}`);
      }
      
      toast.success("Explanation evaluated!");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="feynman-page-container p-4 md:p-8 font-body max-w-7xl mx-auto w-full">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pt-6">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl font-black tracking-tight text-white mb-2 flex items-center gap-4">
            Feynman Room <span className="material-symbols-outlined text-secondary text-5xl">forum</span>
          </h1>
          <p className="text-white/70 font-body text-sm md:text-base max-w-2xl">
            The ultimate test of understanding: explain a concept simply. Shiro will act as a curious student.
          </p>
        </div>
      </header>

      {!concept ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10">
          <div className="feynman-glass p-10 rounded-3xl w-full max-w-xl relative overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-[80px] pointer-events-none"></div>
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Start a Challenge</h2>
            
            <div className="space-y-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary/80">Source Material</label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-secondary/50 outline-none"
                >
                  <option value="">-- Choose a Document --</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>📄 {doc.filename}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={startChallenge}
                disabled={loading || !selectedDocId}
                className="w-full mt-4 py-4 bg-gradient-to-br from-secondary to-[#c084fc] text-white font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(221,139,251,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="material-symbols-outlined animate-spin">sync</span> Generating...</>
                ) : (
                  <><span className="material-symbols-outlined">psychology</span> Select Concept</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : !evaluation ? (
        <div className="flex flex-col gap-8 flex-1">
          <div className="feynman-glass p-8 rounded-3xl border border-secondary/30 relative overflow-hidden shadow-lg shadow-secondary/10">
             <span className="text-[10px] uppercase font-bold tracking-widest text-secondary opacity-80 mb-2 block">Your Challenge</span>
             <h2 className="text-3xl font-black text-white">Explain: "{concept}"</h2>
             <p className="mt-4 text-white/70">Imagine I know nothing about this. Explain it simply, using analogies if possible. Speak or type your answer below.</p>
          </div>

          <div className="flex-1 flex flex-col gap-4">
             <div className="relative flex-1 min-h-[300px]">
               <textarea 
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Start explaining here..."
                  className="w-full h-full bg-black/20 border border-white/10 rounded-3xl p-6 text-white outline-none focus:border-secondary/50 resize-none font-body text-lg leading-relaxed shadow-inner"
               ></textarea>
               
               <div className="absolute bottom-6 right-6 flex gap-4">
                 <button 
                    onClick={toggleRecording}
                    className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg border ${isRecording ? 'bg-red-500 text-white border-red-400 pulse-ring' : 'bg-surface-container-high text-white border-white/10 hover:bg-secondary/20 hover:text-secondary hover:border-secondary/30'}`}
                 >
                    <span className="material-symbols-outlined text-2xl">{isRecording ? 'mic_off' : 'mic'}</span>
                 </button>
               </div>
             </div>

             <div className="flex justify-between items-center mt-2">
                <button 
                  onClick={() => setConcept(null)}
                  className="px-6 py-3 rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold text-sm"
                >
                  Skip Concept
                </button>

                <button 
                  onClick={submitExplanation}
                  disabled={loading || explanation.trim().length === 0}
                  className="px-8 py-3 rounded-xl bg-gradient-to-br from-secondary to-[#c084fc] text-white font-bold transition-all shadow-[0_0_15px_rgba(221,139,251,0.3)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : null}
                  Submit Explanation
                </button>
             </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-8 pb-10">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 feynman-glass p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center">
                 <div className="w-24 h-24 rounded-full border-4 border-white/10 flex items-center justify-center mb-4 relative">
                    <span className={`text-4xl font-black ${getScoreColor(evaluation.mastery_score || 0)}`}>{evaluation.mastery_score || 0}</span>
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="48" cy="48" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4"></circle>
                      <circle cx="48" cy="48" r="46" fill="none" stroke={evaluation.mastery_score >= 80 ? '#34d399' : evaluation.mastery_score >= 60 ? '#fbbf24' : '#f87171'} strokeWidth="4" strokeDasharray="289" strokeDashoffset={289 - (289 * (evaluation.mastery_score || 0)) / 100}></circle>
                    </svg>
                 </div>
                 <h3 className="text-xl font-bold text-white mb-1">Mastery Score</h3>
                 <p className="text-sm text-white/50">Overall understanding</p>
              </div>

              <div className="md:col-span-2 feynman-glass p-8 rounded-3xl border border-secondary/20 bg-secondary/5">
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <span className="material-symbols-outlined text-secondary">auto_awesome</span>
                   Shiro's Feedback
                 </h3>
                 <div className="prose prose-invert max-w-none text-white/80 leading-relaxed text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{evaluation.shiro_response}</ReactMarkdown>
                 </div>
              </div>
           </div>

           <div className="feynman-glass p-8 rounded-3xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-6">Knowledge Gaps Identified</h3>
              {evaluation.gaps_identified && evaluation.gaps_identified.length > 0 ? (
                 <ul className="space-y-4">
                   {evaluation.gaps_identified.map((gap, i) => (
                     <li key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-white/5 border border-white/5">
                       <span className="material-symbols-outlined text-amber-400 text-lg mt-0.5">warning</span>
                       <span className="text-white/80 text-sm leading-relaxed">{gap}</span>
                     </li>
                   ))}
                 </ul>
              ) : (
                <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center flex items-center justify-center gap-3">
                  <span className="material-symbols-outlined">verified</span>
                  <span className="font-bold">Incredible! No major gaps were identified. You truly understand this concept.</span>
                </div>
              )}
           </div>

           <div className="flex justify-center mt-4">
              <button 
                onClick={() => setConcept(null)}
                className="px-8 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all shadow-lg flex items-center gap-3 border border-white/10"
              >
                <span className="material-symbols-outlined">psychology</span>
                Challenge Me Again
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default FeynmanPage;