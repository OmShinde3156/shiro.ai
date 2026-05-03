import React, { useEffect } from "react";
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
import StudyPlanPage from "./components/pages/StudyPlanPage";
import DocumentsPage from "./components/pages/DocumentsPage";
import AuthPage from "./components/pages/AuthPage";
import DocumentDetailsPage from "./components/pages/DocumentDetailsPage";
import SettingsPage from "./components/pages/SettingsPage";
import FeynmanPage from "./components/pages/FeynmanPage";
import { useAuth } from "./context/AuthContext";
import { PodcastProvider } from "./context/PodcastContext";
import StudyRoom from "./components/pages/StudyRoom";
import BottomNavBar from "./components/navigation/BottomNavBar";
import CommandPalette from "./components/navigation/CommandPalette";
import './App.css';
import { useLocation } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
  const location = useLocation();
  const isStudyRoom = location.pathname === "/study-room";

  useEffect(() => {
    if (user && !localStorage.getItem("shiro_tour_completed")) {
      const driverObj = driver({
        showProgress: true,
        steps: [
          { element: '.group\\/upload', popover: { title: 'Upload Materials', description: 'Start here! Upload your PDFs, notes, or images.', side: "right", align: 'start' }},
          { element: '.bento-hover', popover: { title: 'Quick Actions', description: 'Instantly generate quizzes, flashcards, and summaries.', side: "bottom", align: 'start' }},
          { element: '.tour-chat-input', popover: { title: 'Shiro Assistant', description: 'Ask Shiro anything about your study materials.', side: "top", align: 'start' }},
          { element: '.tour-mode-toggle', popover: { title: 'Study Modes', description: 'Switch between Human and Surgical AI modes.', side: "top", align: 'start' }},
        ]
      });
      
      setTimeout(() => {
        try {
          driverObj.drive();
          localStorage.setItem("shiro_tour_completed", "true");
        } catch (e) {
          console.error("Tour failed to start", e);
        }
      }, 1500); // Wait for animations
    }
  }, [user]);

  return (
    <PodcastProvider>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(21, 25, 38, 0.9)',
            color: '#fff',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px'
          },
          success: { iconTheme: { primary: '#72dcff', secondary: '#151926' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#151926' } },
        }}
      />
      <CommandPalette />
      <div className="flex min-h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] font-body">
        {user && !isStudyRoom && (
          <>
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <BottomNavBar />
          </>
        )}
        <div className={`flex-grow overflow-y-auto ${user && !isStudyRoom ? 'md:ml-20 lg:mr-20 pb-24 md:pb-0' : ''}`}>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Main />
              </ProtectedRoute>
            } />

            <Route path="/study-room" element={
              <ProtectedRoute>
                <StudyRoom />
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
            
            <Route path="/documents" element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/documents/:id" element={
              <ProtectedRoute>
                <DocumentDetailsPage />
              </ProtectedRoute>
            } />
            
            <Route path="/study-plan" element={
              <ProtectedRoute>
                <StudyPlanPage />
              </ProtectedRoute>
            } />

            <Route path="/feynman" element={
              <ProtectedRoute>
                <FeynmanPage />
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
        {user && !isStudyRoom && <RightSidebar />}
      </div>
    </PodcastProvider>
  );
}

export default App;
