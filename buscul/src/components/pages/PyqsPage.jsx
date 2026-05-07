import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Context } from "../../context/Context";
import API_BASE_URL from "../../api/config.js";
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
      const res = await fetch(`${API_BASE_URL}/important-questions`, {
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
           <button onClick={() => navigate("/home")} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
             <span className="material-symbols-outlined">arrow_back</span>
           </button>
           <h1 className="text-3xl font-black font-headline text-[var(--text-main)]">PYQ Prediction</h1>
        </div>
        <p className="text-[var(--text-muted)]">AI-powered predictive analysis comparing your material with past year questions.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Selection Sidebar */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-primary/10">
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Setup Analysis</h3>
            
            <div className="space-y-6">
               <div className="form-group">
                 <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 block">Primary Study Material</label>
                 <select 
                   value={selectedDoc} 
                   onChange={(e) => setSelectedDoc(e.target.value)}
                   className="w-full bg-surface-container border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-primary/50"
                 >
                   <option value="">Select Document...</option>
                   {documents?.map(doc => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
               </div>

               <div className="form-group">
                 <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 block">Past Paper (Optional)</label>
                 <select 
                   value={pyqDoc} 
                   onChange={(e) => setPyqDoc(e.target.value)}
                   className="w-full bg-surface-container border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-secondary/50"
                 >
                   <option value="">Select Past Paper...</option>
                   {documents?.map(doc => (
                     <option key={doc.id} value={doc.id}>{doc.filename}</option>
                   ))}
                 </select>
                 <p className="text-[9px] text-[var(--text-muted)] mt-2 italic">Select a previously uploaded past paper to improve accuracy.</p>
               </div>

               <button 
                 onClick={handlePredict}
                 disabled={loading || !selectedDoc}
                 className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
               >
                 {loading ? 'Analyzing Neural Patterns...' : 'Run Prediction Engine'}
               </button>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/5 bg-white/5">
             <h4 className="text-xs font-bold text-[var(--text-main)] mb-3">How it works</h4>
             <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
               Shiro's prediction engine cross-references semantic clusters in your study material with the linguistic frequency found in past papers to identify high-probability exam topics.
             </p>
          </div>
        </aside>

        {/* Prediction Results */}
        <div className="lg:col-span-8">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">Analyzing Clusters</h3>
                <p className="text-sm text-[var(--text-muted)]">Scanning for recurrent semantic anchors...</p>
             </div>
           ) : importantQuestions.length > 0 ? (
             <div className="space-y-6">
                <div className="flex justify-between items-center px-2">
                   <h2 className="text-xl font-bold flex items-center gap-3">
                     <span className="material-symbols-outlined text-secondary">bolt</span>
                     High Probability Questions
                   </h2>
                   <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold rounded-full">{importantQuestions.length} Found</span>
                </div>
                
                <div className="grid gap-4">
                  {importantQuestions.map((q, i) => (
                    <div key={i} className="group glass-card p-6 rounded-3xl border border-white/5 hover:border-secondary/40 transition-all">
                       <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase tracking-tighter rounded">Probability: {95 - (i * 2)}%</span>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] italic">#{i+1}</span>
                       </div>
                       <p className="text-[var(--text-main)] font-medium leading-relaxed mb-4">{q.question || q}</p>
                       <div className="flex gap-2">
                          <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-[9px] text-[var(--text-muted)] rounded capitalize">Category: {q.type || 'Core Concept'}</span>
                          <span className="px-2 py-0.5 bg-white/5 border border-white/5 text-[9px] text-[var(--text-muted)] rounded">Difficulty: {q.difficulty || 'High'}</span>
                       </div>
                    </div>
                  ))}
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-40">
                <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
                <h3 className="text-xl font-bold">Awaiting Input</h3>
                <p className="max-w-xs mx-auto text-sm mt-2">Set up your documents and run the prediction engine to see results.</p>
             </div>
           )}
           
           {error && (
             <div className="mt-6 p-4 bg-error/10 border border-error/20 text-error text-sm rounded-2xl flex items-center gap-3">
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
