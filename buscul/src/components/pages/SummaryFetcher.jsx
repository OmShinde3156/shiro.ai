import React, { useState } from "react";
import ReactMarkdown from "react-markdown"; // ✅ import markdown renderer
import "./SummaryFetcher.css";
import API_BASE_URL from "../../api/config.js";

const SummaryFetcher = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document_id: 1,
          summary_type: "detailed",
          language: "en",
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSummary(data.summary_text); // ✅ markdown text from API
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="summary-container">
      <h2 className="summary-title">📘 Document Summary</h2>
      <button onClick={fetchSummary} disabled={loading} className="fetch-btn">
        {loading ? "Fetching..." : "Get Summary"}
      </button>

      {error && <p className="error-text">{error}</p>}

      {summary && (
        <div className="summary-box">
          {/* ✅ nicely render markdown */}
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default SummaryFetcher;

