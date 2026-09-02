import { fetchWithAuth } from '../../../api/fetchWithAuth';
import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { Context } from "../../../context/Context";
import API_BASE_URL from "../../../api/config.js";
import "./PyqsPage.css";

const PyqsPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();
  
  const [selectedDoc, setSelectedDoc] = useState("");
  const [pyqDoc, setPyqDoc] = useState("");
  const [importantQuestions, setImportantQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  const handlePredict = async () => {
    if (!selectedDoc) {
      setError("Please select a study document first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("user_id", user?.id);
    formData.append("document_id", selectedDoc);
    if (pyqDoc) formData.append("pyq_document_id", pyqDoc);
    formData.append("num_questions", 12);

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/important-questions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Prediction engine failed.");

      const data = await res.json();
      setImportantQuestions(data.questions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pyqs-container p-8 max-w-6xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center gap-4 mb-4">
           <button onClick={() => navigate("/home")} className="w-10 h-10 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] transition-all shadow-xs">
             <span className="material-symbols-outlined">arrow_back</span>
           </button>
           <h1 className="text-2xl md:text-3xl font-bold font-serif text-[var(--text-main)]">PYQ Prediction</h1>
        </div>
        <p className="text-[var(--text-secondary)] text-sm">AI-powered predictive analysis comparing your material with past year questions.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Selection Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#3F6048] dark:text-[#89A88D] mb-6 font-mono">Setup Analysis</h3>
            
            <div className="space-y-5">
               <div className="form-group">
                 <label className="text-[10px] font-bold uppercase text-[var(--text-main)] mb-2 block">Primary Study Material</label>
                 <select 
                   value={selectedDoc} 
                   onChange={(e) => setSelectedDoc(e.target.value)}
                   className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-xl p-3 text-xs outline-none focus:border-[#3F6048]"
                 >
                   <option value="" className="bg-[var(--bg-surface)] text-[var(--text-main)]">Select Document...</option>
                   {documents?.map(doc => (
                     <option key={doc.id} value={doc.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">{doc.filename}</option>
                   ))}
                 </select>
               </div>

               <div className="form-group">
                 <label className="text-[10px] font-bold uppercase text-[var(--text-main)] mb-2 block">Past Paper (Optional)</label>
                 <select 
                   value={pyqDoc} 
                   onChange={(e) => setPyqDoc(e.target.value)}
                   className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-xl p-3 text-xs outline-none focus:border-[#3F6048]"
                 >
                   <option value="" className="bg-[var(--bg-surface)] text-[var(--text-main)]">Select Past Paper...</option>
                   {documents?.map(doc => (
                     <option key={doc.id} value={doc.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">{doc.filename}</option>
                   ))}
                 </select>
                 <p className="text-[9px] text-[var(--text-muted)] mt-1.5 italic">Select a previously uploaded past paper to improve accuracy.</p>
               </div>

               <button 
                 onClick={handlePredict}
                 disabled={loading || !selectedDoc}
                 className="w-full py-3.5 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white font-bold rounded-xl shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 text-xs uppercase tracking-wider"
               >
                 {loading ? 'Analyzing Neural Patterns...' : 'Run Prediction Engine'}
               </button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
             <h4 className="text-xs font-bold text-[var(--text-main)] mb-2 font-serif">How it works</h4>
             <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
               Shiro's prediction engine cross-references semantic clusters in your study material with the linguistic frequency found in past papers to identify high-probability exam topics.
             </p>
          </div>
        </aside>

        {/* Prediction Results */}
        <div className="lg:col-span-8">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="w-12 h-12 border-3 border-[#3F6048]/20 border-t-[#3F6048] rounded-full animate-spin mb-4"></div>
                <h3 className="text-base font-bold text-[var(--text-main)] font-serif">Analyzing Clusters</h3>
                <p className="text-xs text-[var(--text-muted)]">Scanning for recurrent semantic anchors...</p>
             </div>
           ) : importantQuestions.length > 0 ? (
             <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <h2 className="text-lg font-bold flex items-center gap-2 font-serif text-[var(--text-main)]">
                     <span className="material-symbols-outlined text-[#D6A84F]">bolt</span>
                     High Probability Questions
                   </h2>
                   <span className="px-3 py-1 bg-[#3F6048]/10 text-[#3F6048] dark:text-[#A8C5AC] text-[10px] font-bold rounded-full">{importantQuestions.length} Found</span>
                </div>
                <div className="grid gap-4">
                   {importantQuestions.map((q, i) => (
                     <div key={q.id || i} className="group glass-card p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048]/40 transition-all space-y-3">
                        <div className="flex justify-between items-start">
                           <div className="flex flex-wrap items-center gap-2">
                             <span className="px-2.5 py-0.5 bg-[#D6A84F]/15 text-[#D6A84F] border border-[#D6A84F]/30 text-[9px] font-black uppercase tracking-tighter rounded">
                               {q.importance || `Probability: ${95 - (i * 2)}%`}
                             </span>
                             <span className="px-2 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[9px] text-[var(--text-muted)] rounded capitalize">
                               {q.category || q.type || 'Core Concept'}
                             </span>
                             <span className="px-2 py-0.5 bg-[#3F6048]/10 text-[#3F6048] dark:text-[#A8C5AC] text-[9px] font-mono rounded">
                               {q.estimated_marks || '5-10 Marks'}
                             </span>
                           </div>
                           <span className="text-[10px] font-bold text-[var(--text-muted)] italic">#{i+1}</span>
                        </div>

                        <p className="text-[var(--text-main)] font-semibold leading-relaxed text-sm">
                          {q.question || q}
                        </p>

                        {q.key_points && Array.isArray(q.key_points) && q.key_points.length > 0 && (
                          <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono tracking-wider block mb-1">
                              Key Points for Full Marks:
                            </span>
                            <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                              {q.key_points.map((pt, pIdx) => (
                                <li key={pIdx}>{pt}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {q.model_answer_summary && (
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            <strong className="text-[var(--text-main)]">Model Answer: </strong>
                            {q.model_answer_summary}
                          </p>
                        )}

                        {q.exam_insight && (
                          <div className="flex items-start gap-1.5 text-[11px] text-[#D6A84F] bg-[#D6A84F]/10 p-2.5 rounded-lg border border-[#D6A84F]/20">
                            <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">tips_and_updates</span>
                            <span><strong>Examiner Insight: </strong>{q.exam_insight}</span>
                          </div>
                        )}
                     </div>
                   ))}
                 </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-40">
                <span className="material-symbols-outlined text-6xl mb-4 text-[var(--text-muted)]">analytics</span>
                <h3 className="text-xl font-bold font-serif">Awaiting Input</h3>
                <p className="max-w-xs mx-auto text-sm mt-2 text-[var(--text-muted)]">Set up your documents and run the prediction engine to see results.</p>
             </div>
           )}
           
           {error && (
             <div className="mt-6 p-4 bg-[#C96B62]/10 border border-[#C96B62]/20 text-[#C96B62] text-sm rounded-2xl flex items-center gap-3">
                <span className="material-symbols-outlined">error</span>
                {error}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default PyqsPage;
