import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from 'react-hot-toast';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Feature Domains
import { AuthPage, LandingPage } from "./features/auth";
import { ChatPage } from "./features/chat";
import { 
  QuizPage, 
  AudioSummaryPage, 
  FlashcardApp, 
  MindMapPage, 
  SummaryFetcher, 
  PyqsPage, 
  FeynmanPage 
} from "./features/study";
import { DocumentsPage, DocumentDetailsPage } from "./features/library";
import { StudyRoom, StudyRoomLobby } from "./features/collaboration";
import { 
  ProgressReport, 
  AnswerPlanner, 
  StudyPlanPage, 
  SettingsPage 
} from "./features/insights";

// Global Layout & Contexts
import Sidebar from "./components/sidebar/Sidebar";
import RightSidebar from "./components/rightsidebar/RightSidebar";
import Header from "./components/navigation/Header";
import BottomNavBar from "./components/navigation/BottomNavBar";
import CommandPalette from "./components/navigation/CommandPalette";
import AuroraBackground from "./components/ui/AuroraBackground";
import { useAuth } from "./context/AuthContext";
import { PodcastProvider } from "./context/PodcastContext";
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--bg-canvas)]">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const { user, loading } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const isAuthenticated = Boolean(user && token);
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isStudyRoom = location.pathname === "/study-rooms" || location.pathname.startsWith("/room/");

  useEffect(() => {
    // Tour runs for both guest and logged-in users, but not on landing page
    if (!isLandingPage && !isAuthPage && isAuthenticated && !localStorage.getItem("shiro_tour_completed")) {
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
  }, [isLandingPage, isAuthPage, isAuthenticated]);

  // Full-screen routes (no sidebar/header)
  const isFullScreenRoute = isStudyRoom || isLandingPage || isAuthPage || !isAuthenticated;

  return (
    <PodcastProvider>
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(24, 25, 22, 0.95)',
            color: '#F4F1E9',
            backdropFilter: 'blur(12px)',
            border: '1px solid #2B2D28',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 500
          },
          success: { iconTheme: { primary: '#89A88D', secondary: '#181916' } },
          error: { iconTheme: { primary: '#C96B62', secondary: '#181916' } },
        }}
      />
      {!isFullScreenRoute && <CommandPalette />}
      <div className="flex h-screen h-[100dvh] w-full bg-[var(--bg-main)] text-[var(--text-main)] font-body overflow-hidden">
        {!isFullScreenRoute && (
          <>
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <BottomNavBar />
          </>
        )}
        <div className={`flex flex-col flex-grow h-screen h-[100dvh] overflow-hidden ${!isFullScreenRoute ? 'md:ml-20 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0' : ''}`}>
          {!isFullScreenRoute && <Header />}
          <AuroraBackground className="flex-grow h-full w-full overflow-hidden">
            <div id="scroll-container" className="flex-grow overflow-y-auto relative w-full h-full custom-scroll touch-scroll">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/register" element={<AuthPage initialMode="register" />} />
                <Route path="/home" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                <Route path="/study-rooms" element={<ProtectedRoute><StudyRoomLobby /></ProtectedRoute>} />
                <Route path="/room/:roomId" element={<ProtectedRoute><StudyRoom /></ProtectedRoute>} />
                <Route path="/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
                <Route path="/progress-report" element={<ProtectedRoute><ProgressReport /></ProtectedRoute>} />
                <Route path="/audio-summary" element={<ProtectedRoute><AudioSummaryPage /></ProtectedRoute>} />
                <Route path="/flashcards" element={<ProtectedRoute><FlashcardApp /></ProtectedRoute>} />
                <Route path="/mindmap" element={<ProtectedRoute><MindMapPage /></ProtectedRoute>} />
                <Route path="/answer-planner" element={<ProtectedRoute><AnswerPlanner /></ProtectedRoute>} />
                <Route path="/summary" element={<ProtectedRoute><SummaryFetcher /></ProtectedRoute>} />
                <Route path="/pyqs" element={<ProtectedRoute><PyqsPage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
                <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetailsPage /></ProtectedRoute>} />
                <Route path="/study-plan" element={<ProtectedRoute><StudyPlanPage /></ProtectedRoute>} />
                <Route path="/feynman" element={<ProtectedRoute><FeynmanPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </AuroraBackground>
        </div>
      </div>
    </PodcastProvider>
  );
}

export default App;
