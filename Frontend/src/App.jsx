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

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  const isStudyRoom = location.pathname === "/study-rooms" || location.pathname.startsWith("/room/");

  useEffect(() => {
    // Tour runs for both guest and logged-in users, but not on landing page
    if (!isLandingPage && !isAuthPage && !localStorage.getItem("shiro_tour_completed")) {
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
  }, [isLandingPage, isAuthPage]);

  // Full-screen routes (no sidebar/header)
  const isFullScreenRoute = isStudyRoom || isLandingPage || isAuthPage;

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
                <Route path="/home" element={<ChatPage />} />
                <Route path="/study-rooms" element={<StudyRoomLobby />} />
                <Route path="/room/:roomId" element={<StudyRoom />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/progress-report" element={<ProgressReport />} />
                <Route path="/audio-summary" element={<AudioSummaryPage />} />
                <Route path="/flashcards" element={<FlashcardApp />} />
                <Route path="/mindmap" element={<MindMapPage />} />
                <Route path="/answer-planner" element={<AnswerPlanner />} />
                <Route path="/summary" element={<SummaryFetcher />} />
                <Route path="/pyqs" element={<PyqsPage />} />
                <Route path="/documents" element={<DocumentsPage />} />
                <Route path="/documents/:id" element={<DocumentDetailsPage />} />
                <Route path="/study-plan" element={<StudyPlanPage />} />
                <Route path="/feynman" element={<FeynmanPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
