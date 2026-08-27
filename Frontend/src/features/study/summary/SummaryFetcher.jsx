import { fetchWithAuth } from '../../../api/fetchWithAuth';
import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown"; 
import { Context } from "../../../context/Context";
import { useAuth } from "../../../context/AuthContext";
import API_BASE_URL from "../../../api/config.js";
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
          <h1 className="text-3xl font-bold font-serif text-[var(--text-main)]">Document Summary</h1>
          <p className="text-[var(--text-muted)]">Turn complex chapters into bite-sized, high-retention summaries.</p>
        </div>
        <button onClick={() => navigate("/home")} className="px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text-main)] transition-all">
          Back to Home
        </button>
      </div>

      <div className="glass-card p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] mb-8">
        <h3 className="text-sm font-bold uppercase tracking-widest text-[#3F6048] dark:text-[#89A88D] mb-4">Setup Summary</h3>
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-grow w-full">
             <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] mb-2 block">Source Material</label>
             <select
               value={selectedDocId}
               onChange={(e) => setSelectedDocId(e.target.value)}
               className="bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm outline-none focus:border-[#3F6048] w-full text-[var(--text-main)]"
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
               className="bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm outline-none focus:border-[#3F6048] w-full text-[var(--text-main)]"
             >
               <option value="detailed">Detailed Overview</option>
               <option value="bullet">Bullet Points</option>
               <option value="executive">Executive Summary</option>
             </select>
          </div>
          <button
            onClick={fetchSummary}
            disabled={!selectedDocId || loading}
            className="w-full md:w-auto py-3 px-8 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white font-bold rounded-xl shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "Summarizing..." : "Generate"}
          </button>
        </div>
        {error && <p className="text-[#C96B62] text-sm mt-4">{error}</p>}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-[#3F6048]/20 border-t-[#3F6048] rounded-full animate-spin mb-4"></div>
          <p className="text-[var(--text-main)] font-bold">Compressing Knowledge...</p>
        </div>
      )}

      {summary && !loading && (
        <div className="glass-card p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="prose max-w-none text-[var(--text-main)]">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryFetcher;
