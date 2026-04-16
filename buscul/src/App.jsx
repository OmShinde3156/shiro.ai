import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Main from "./components/main/Main";
import QuizPage from "./components/pages/QuizPage";
import AudioSummaryPage from "./components/pages/AudioSummaryPage";
import FlashcardApp from "./components/pages/FlashcardApp";
import MindMapPage from "./components/pages/MindMapPage";
import Sidebar from "./components/sidebar/Sidebar";
import RightSidebar from "./components/rightsidebar/RightSidebar";
import SummaryFetcher from "./components/pages/SummaryFetcher";
import PyqsPage from "./components/pages/PyqsPage";
import ProgressReport from "./components/pages/ProgressReport";
import AuthPage from "./components/pages/AuthPage";
import DocumentDetailsPage from "./components/pages/DocumentDetailsPage";
import SettingsPage from "./components/pages/SettingsPage";
import { useAuth } from "./context/AuthContext";
import { PodcastProvider } from "./context/PodcastContext";
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const { user } = useAuth();

  return (
    <PodcastProvider>
      <div className="flex min-h-screen w-full bg-background text-on-surface font-body">
        {user && <Sidebar />}
        <div className="flex-grow overflow-y-auto">
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Main />
              </ProtectedRoute>
            } />
            
            <Route path="/quiz" element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            } />
            
            <Route path="/progress-report" element={
              <ProtectedRoute>
                <ProgressReport />
              </ProtectedRoute>
            } />
            
            <Route path="/audio-summary" element={
              <ProtectedRoute>
                <AudioSummaryPage />
              </ProtectedRoute>
            } />
            
            <Route path="/flashcards" element={
              <ProtectedRoute>
                <FlashcardApp />
              </ProtectedRoute>
            } />
            
            <Route path="/mindmap" element={
              <ProtectedRoute>
                <MindMapPage />
              </ProtectedRoute>
            } />
            
            <Route path="/summary" element={
              <ProtectedRoute>
                <SummaryFetcher />
              </ProtectedRoute>
            } />
            
            <Route path="/pyqs" element={
              <ProtectedRoute>
                <PyqsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/documents/:id" element={
              <ProtectedRoute>
                <DocumentDetailsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />

            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {user && <RightSidebar />}
      </div>
    </PodcastProvider>
  );
}

export default App;
