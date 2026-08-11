import { useState, useEffect, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Context } from "../../context/Context";
import API_BASE_URL from "../../api/config.js";
import "../main/main.css"; // Reuse main styles or add QuizPage.css later

const QuizPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");
  const [quizData, setQuizData] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  // Set default document if available and none selected
  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      const docId = location.state?.documentId || documents[0].id;
      setSelectedDocId(docId);
    }
  }, [documents, selectedDocId, location.state]);

  const fetchQuiz = async () => {
    if (!selectedDocId) {
      setError("Please select a document to generate a quiz.");
      return;
    }
    setLoading(true);
    setError(null);
    setQuizData(null);
    setSubmitted(false);
    setSelectedAnswers({});

    try {
      const payload = {
        document_id: parseInt(selectedDocId),
        num_questions: 5, // Lowered for quicker testing, can be a setting
        difficulty: "medium",
      };

      const response = await fetch(`${API_BASE_URL}/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to fetch quiz");

      const data = await response.json();
      setQuizData(data.questions);
      setQuizId(data.quiz_id);
    } catch (error) {
      console.error(error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionIndex, optionKey) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionKey,
    }));
  };

  const submitQuiz = async () => {
    let calculatedScore = 0;
    const formattedAnswers = {};
    
    quizData.forEach((q, idx) => {
      formattedAnswers[q.id] = selectedAnswers[idx] || "";
      if (selectedAnswers[idx] === q.correct_answer) {
        calculatedScore++;
      }
    });

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/submit-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          document_id: parseInt(selectedDocId),
          quiz_id: quizId,
          answers: formattedAnswers
        })
      });
      if (!response.ok) {
        console.error("Failed to submit quiz analytics to backend");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setSubmitted(true);
      
      // Navigate to ProgressReport with score + total
      setTimeout(() => {
        navigate("/progress-report", {
          state: { score: calculatedScore, total: quizData.length },
        });
      }, 1500); // Give user a moment to see they submitted
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline text-[var(--text-main)]">Quiz Time!</h1>
          <p className="text-[var(--text-muted)]">Test your knowledge dynamically based on your documents.</p>
        </div>
        <button onClick={() => navigate("/home")} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-[var(--text-main)] transition-all">
          Back to Home
        </button>
      </div>

      {!quizData && !loading && (
        <div className="glass-card p-6 rounded-3xl border border-white/5 mb-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">Setup Quiz</h3>
          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Select Source Material</label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-surface-container border border-white/5 rounded-xl p-3 text-sm outline-none focus:border-primary/50 w-full"
            >
              <option value="">-- Choose a Document --</option>
              {documents?.map(doc => (
                <option key={doc.id} value={doc.id}>{doc.filename}</option>
              ))}
            </select>
            <button
              onClick={fetchQuiz}
              disabled={!selectedDocId}
              className="mt-2 py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Generate Quiz
            </button>
            {error && <p className="text-error text-sm mt-2">{error}</p>}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-[var(--text-main)] font-bold">Generating adaptive questions...</p>
        </div>
      )}

      {quizData && (
        <div className="space-y-6">
          {quizData.map((q, idx) => (
            <div key={idx} className="glass-card p-6 rounded-2xl border border-white/5">
              <p className="text-[var(--text-main)] font-bold mb-4 text-lg">
                <span className="text-primary mr-2">{idx + 1}.</span> {q.question}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(q.options).map(([key, value]) => (
                  <div
                    key={key}
                    className={`p-4 rounded-xl cursor-pointer transition-all border flex items-center gap-3
                      ${selectedAnswers[idx] === key 
                        ? "bg-primary/20 border-primary text-primary" 
                        : "bg-white/5 border-white/5 hover:bg-white/10 text-[var(--text-muted)]"
                      }
                      ${submitted && key === q.correct_answer ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : ""}
                      ${submitted && selectedAnswers[idx] === key && key !== q.correct_answer ? "bg-error/20 border-error text-error" : ""}
                    `}
                    onClick={() => !submitted && handleOptionSelect(idx, key)}
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-md bg-black/20 text-xs font-bold uppercase">{key}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              {submitted && (
                <div className="mt-4 p-4 bg-surface-container rounded-xl border border-white/5">
                  <p className="text-sm text-[var(--text-muted)]"><span className="font-bold text-[var(--text-main)]">Explanation:</span> {q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {!submitted ? (
            <button
              onClick={submitQuiz}
              disabled={Object.keys(selectedAnswers).length < quizData.length}
              className="w-full py-4 bg-primary text-on-primary font-bold text-lg rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-primary/20 mt-8"
            >
              {Object.keys(selectedAnswers).length < quizData.length ? "Answer all questions to submit" : "Submit Quiz"}
            </button>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">Quiz Submitted!</h2>
              <p className="text-[var(--text-muted)]">Saving your progress and redirecting to analytics...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizPage;
