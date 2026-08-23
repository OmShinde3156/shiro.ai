import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown"; 
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import "./SummaryFetcher.css";

const SummaryFetcher = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [summaryType, setSummaryType] = useState("detailed");

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  // Default to first doc if available
  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  const fetchSummary = async () => {
    if (!selectedDocId) {
      setError("Please select a document first.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: parseInt(selectedDocId),
          summary_type: summaryType,
          language: "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data.summary_text);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline text-[var(--text-main)]">Document Summary</h1>
          <p className="text-[var(--text-muted)]">Turn complex chapters into bite-sized, high-retention summaries.</p>
        </div>
        <button onClick={() => navigate("/home")} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-[var(--text-main)] transition-all">
          Back to Home
        </button>
      </div>

      <div className="glass-card p-6 rounded-3xl border border-white/5 mb-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Setup Summary</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-grow w-full">
             <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 block">Source Material</label>
             <select
               value={selectedDocId}
               onChange={(e) => setSelectedDocId(e.target.value)}
               className="bg-surface-container border border-white/5 rounded-xl p-3 text-sm outline-none focus:border-primary/50 w-full text-[var(--text-main)]"
             >
               <option value="">-- Choose a Document --</option>
               {documents?.map(doc => (
                 <option key={doc.id} value={doc.id}>{doc.filename}</option>
               ))}
             </select>
          </div>
          <div className="w-full md:w-1/3">
             <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 block">Summary Type</label>
             <select
               value={summaryType}
               onChange={(e) => setSummaryType(e.target.value)}
               className="bg-surface-container border border-white/5 rounded-xl p-3 text-sm outline-none focus:border-primary/50 w-full text-[var(--text-main)]"
             >
               <option value="detailed">Detailed Overview</option>
               <option value="bullet">Bullet Points</option>
               <option value="executive">Executive Summary</option>
             </select>
          </div>
          <button
            onClick={fetchSummary}
            disabled={!selectedDocId || loading}
            className="w-full md:w-auto py-3 px-8 bg-gradient-to-r from-primary to-primary-container text-[var(--bg-main)] font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Summarizing..." : "Generate"}
          </button>
        </div>
        {error && <p className="text-error text-sm mt-4">{error}</p>}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-[var(--text-main)] font-bold">Compressing Knowledge...</p>
        </div>
      )}

      {summary && !loading && (
        <div className="glass-card p-8 rounded-3xl border border-white/5 bg-white/5">
          <div className="prose prose-invert max-w-none prose-p:text-[var(--text-main)]/90 prose-headings:text-[var(--text-main)] prose-li:text-[var(--text-main)]/80 prose-strong:text-[var(--primary)]">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryFetcher;
