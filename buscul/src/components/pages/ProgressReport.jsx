import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import "./progressreport.css";
import { useAuth } from "../../context/AuthContext";

const ProgressReport = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { score = 0, total = 0 } = location.state || {};
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const historyKey = `quizHistory_${user.email}`;
    const stored = JSON.parse(localStorage.getItem(historyKey)) || [];

    if (location.state && location.state.score !== undefined) {
      const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
      const newEntry = {
        attempt: stored.length + 1,
        score: percentage,
      };

      const updated = [...stored, newEntry];
      setHistory(updated);
      localStorage.setItem(historyKey, JSON.stringify(updated));
      
      // Clear location.state to prevent re-adding score on user change
      navigate(location.pathname, { replace: true, state: null });
    } else {
      setHistory(stored);
    }
  }, [user, location.state, navigate, score, total]);

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const getFeedback = () => {
    if (percentage === 100) return "🔥 Perfect score! You're a master!";
    if (percentage >= 75) return "✅ Great job! You're doing really well.";
    if (percentage >= 50) return "👍 Not bad, keep practicing.";
    return "💡 Keep trying, you’ll get better!";
  };

  if (!user) {
    return (
      <div className="progress-container">
        <h1>📊 Progress Report</h1>
        <p>Please log in to see your progress.</p>
        <button onClick={() => navigate("/signup")}>Login</button>
      </div>
    );
  }

  return (
    <div className="progress-container">
      <h1>📊 Progress Report</h1>
      <div className="progress-card">
        <h2>Your Score</h2>
        <p>
          {score} / {total}
        </p>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <p className="percentage">{percentage}%</p>
        <p className="feedback">{getFeedback()}</p>
      </div>

      {/* ✅ Chart Section */}
      {history.length > 0 && ( // Show chart even for one entry
        <div className="chart-container">
          <h2>Performance Over Attempts</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="attempt" stroke="#aaa" />
              <YAxis stroke="#aaa" domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#daae51"
                strokeWidth={3}
                dot={{ r: 5, fill: "#f7e98e" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="buttons">
        <button onClick={() => navigate("/quiz")}>🔄 Retry Quiz</button>
        <button onClick={() => navigate("/")}>🏠 Home</button>
      </div>
    </div>
  );
};

export default ProgressReport;

