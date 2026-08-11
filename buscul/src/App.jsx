import React, { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Main from "./components/main/Main";
import QuizPage from "./components/pages/QuizPage";
import AudioSummaryPage from "./components/pages/AudioSummaryPage";
import FlashcardApp from "./components/pages/FlashcardApp";
import MindMapPage from "./components/pages/MindMapPage";
import AnswerPlanner from "./components/pages/AnswerPlanner";
import Sidebar from "./components/sidebar/Sidebar";
import RightSidebar from "./components/rightsidebar/RightSidebar";
import Header from "./components/navigation/Header";
import SummaryFetcher from "./components/pages/SummaryFetcher";
import PyqsPage from "./components/pages/PyqsPage";
import ProgressReport from "./components/pages/ProgressReport";
import StudyPlanPage from "./components/pages/StudyPlanPage";
import DocumentsPage from "./components/pages/DocumentsPage";
import AuthPage from "./components/pages/AuthPage";
import DocumentDetailsPage from "./components/pages/DocumentDetailsPage";
import SettingsPage from "./components/pages/SettingsPage";
import FeynmanPage from "./components/pages/FeynmanPage";
import LandingPage from "./components/pages/LandingPage";
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

function App() {
  const { user } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAuthPage = location.pathname === "/login";
  const isStudyRoom = location.pathname === "/study-room";

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
      <div className="flex h-screen w-full bg-[var(--bg-main)] text-[var(--text-main)] font-body overflow-hidden">
        {!isFullScreenRoute && (
          <>
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <BottomNavBar />
          </>
        )}
        <div className={`flex flex-col flex-grow h-screen overflow-hidden ${!isFullScreenRoute ? 'md:ml-20 pb-24 md:pb-0' : ''}`}>
          {!isFullScreenRoute && <Header />}
          <div id="scroll-container" className="flex-grow overflow-y-auto relative w-full h-full custom-scroll">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/home" element={<Main />} />
              <Route path="/study-room" element={<StudyRoom />} />
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
        </div>
      </div>
    </PodcastProvider>
  );
}

export default App;
