import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../main/main.css";
import API_BASE_URL from "../../api/config.js";

const QuizPage = () => {
  const [quizData, setQuizData] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const payload = {
          document_id: 1, // ✅ can make dynamic later
          num_questions: 10,
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
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, []);

  const handleOptionSelect = (questionIndex, optionKey) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionKey,
    }));
  };

  const submitQuiz = () => {
    let calculatedScore = 0;
    quizData.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_answer) {
        calculatedScore++;
      }
    });
    setSubmitted(true);

    // ✅ Navigate to ProgressReport with score + total
    navigate("/progress-report", {
      state: { score: calculatedScore, total: quizData.length },
    });
  };

  if (loading) return <div className="loader"><hr /><hr /><hr /></div>;

  if (!quizData)
    return (
      <div className="main-container">
        <p style={{ color: "white" }}>No quiz data available.</p>
      </div>
    );

  return (
    <div className="main-container">
      <div className="greet">
        <p>
          <span>Quiz Time!</span>
        </p>
      </div>

      {!submitted && (
        <div>
          {quizData.map((q, idx) => (
            <div
              key={idx}
              className="card"
              style={{ height: "auto", marginBottom: "20px" }}
            >
              <p style={{ marginBottom: "10px" }}>
                {idx + 1}. {q.question}
              </p>
              <div>
                {Object.entries(q.options).map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      padding: "10px",
                      margin: "5px",
                      cursor: "pointer",
                      backgroundColor:
                        selectedAnswers[idx] === key ? "#daae51" : "#303437",
                      color: "white",
                      borderRadius: "5px",
                      border:
                        selectedAnswers[idx] === key
                          ? "2px solid white"
                          : "1px solid #555",
                    }}
                    onClick={() => handleOptionSelect(idx, key)}
                  >
                    {key}: {value}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={submitQuiz}
            style={{
              display: "block",
              margin: "20px auto",
              padding: "10px 20px",
              cursor: "pointer",
              fontSize: "18px",
              backgroundColor: "#daae51",
              color: "black",
              border: "none",
              borderRadius: "50px",
            }}
          >
            Submit Quiz
          </button>
        </div>
      )}
    </div>
  );
};

export default QuizPage;

