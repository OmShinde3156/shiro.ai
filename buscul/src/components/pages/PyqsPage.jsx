import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import "./PyqsPage.css";

const PyqsPage = () => {
  const { user } = useAuth();
  const [importantQuestions, setImportantQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", user?.id || 1);
    formData.append("document_id", 1);
    formData.append("num_questions", 15);

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/important-questions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to fetch important questions");

      const data = await res.json();
      console.log("Backend Response:", data);

      let questions = [];

      // Backend returns array of objects with `question` field
      if (Array.isArray(data.questions)) {
        questions = data.questions.map((q) => (q.question ? q.question : q));
      } else if (Array.isArray(data.important_questions)) {
        questions = data.important_questions.map((q) =>
          q.question ? q.question : q
        );
      } else if (typeof data === "string") {
        questions = [data];
      }

      setImportantQuestions(questions);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pyqs-page">
      <div className="header-section">
        <h1 className="title">Previous Year Questions Analyzer</h1>
        <p className="subtitle">Upload your exam paper to identify the most important questions</p>
      </div>

      <div className="upload-section">
        <div className="upload-area">
          <div className="upload-icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="upload-title">Upload Your Document</h3>
          <p className="upload-description">Supported formats: PDF, DOCX, TXT</p>
          
          <label className="file-input-wrapper">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="file-input"
              disabled={loading}
            />
            <span className={`file-input-button ${loading ? 'loading' : ''}`}>
              {loading ? 'Processing...' : 'Choose File'}
            </span>
          </label>
        </div>

        {loading && (
          <div className="loading-message">
            <div className="loading-spinner"></div>
            <span>Analyzing your document...</span>
          </div>
        )}

        {error && (
          <div className="error-message">
            <div className="error-icon">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="results-section">
        <div className="results-header">
          <div className="results-icon">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </div>
          <h2>Important Questions</h2>
        </div>

        {importantQuestions.length > 0 ? (
          <ol className="questions-list">
            {importantQuestions.map((question, index) => (
              <li key={index} className="question-item">
                <div className="question-number">{index + 1}</div>
                <div className="question-text">{question}</div>
              </li>
            ))}
          </ol>
        ) : (
          !loading && (
            <div className="no-questions">
              <div className="no-questions-icon">
                <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3>No Questions Yet</h3>
              <p>Upload a document to get AI-powered question predictions</p>
            </div>
          )
        )}
      </div>

      <button className="back-btn" onClick={() => window.history.back()}>
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Back to Dashboard</span>
      </button>
    </div>
  );
};

export default PyqsPage;

