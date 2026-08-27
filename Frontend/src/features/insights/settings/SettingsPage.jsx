import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Brain, 
  Layers, 
  Clock, 
  Palette, 
  Bell, 
  FileText, 
  ShieldCheck, 
  Command, 
  Info,
  LogOut, 
  Save, 
  Check, 
  Download, 
  Trash2, 
  Plus, 
  X, 
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Volume2,
  HardDrive,
  Key,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Zap
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import API_BASE_URL from '../../../api/config.js';

export const SettingsPage = () => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const { 
    theme, 
    setTheme, 
    accent, 
    setAccent, 
    density, 
    setDensity, 
    fontSize, 
    setFontSize, 
    animations, 
    setAnimations 
  } = useTheme();

  // Active Settings Tab
  const [activeTab, setActiveTab] = useState('profile');

  // 1. Profile State
  const [profile, setProfile] = useState({
    name: user?.name || localStorage.getItem('shiro_student_name') || 'Scholar',
    email: user?.email || 'scholar@shiro.ai',
    learningGoal: localStorage.getItem('shiro_learning_goal') || 'University', // University, Competitive exams, School, Self-learning
    currentLevel: localStorage.getItem('shiro_current_level') || 'Intermediate', // Beginner, Intermediate, Advanced
    subjects: JSON.parse(localStorage.getItem('shiro_subjects') || '["Biology", "Physics", "Chemistry"]'),
  });
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Sync profile when user auth state updates
  useEffect(() => {
    if (user?.name) {
      setProfile(prev => ({
        ...prev,
        name: user.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  // 2. AI & Chat State
  const [aiChat, setAiChat] = useState({
    defaultMode: localStorage.getItem('shiro_default_mode') || 'tutor', // tutor, exam, feynman
    responseStyle: localStorage.getItem('shiro_response_style') || 'balanced', // concise, balanced, detailed
    useExamples: localStorage.getItem('shiro_style_examples') !== 'false',
    explainDifficultTerms: localStorage.getItem('shiro_style_terms') !== 'false',
    askFollowUpQuestions: localStorage.getItem('shiro_style_followups') !== 'false',
    streamingResponses: localStorage.getItem('shiro_streaming') !== 'false',
    showCitations: localStorage.getItem('shiro_show_citations') !== 'false',
    codeSyntaxHighlighting: localStorage.getItem('shiro_syntax_highlight') !== 'false',
  });

  // 3. Study Preferences State
  const [studyPrefs, setStudyPrefs] = useState({
    dailyStudyGoalMins: parseInt(localStorage.getItem('shiro_daily_study_goal') || '60', 10),
    preferredStudyTime: localStorage.getItem('shiro_pref_study_time') || 'Evening', // Morning, Afternoon, Evening, Night
    difficulty: localStorage.getItem('shiro_difficulty') || 'Adaptive',
    sessionLength: parseInt(localStorage.getItem('shiro_session_length') || '25', 10), // 25, 45, 60
    breakReminders: localStorage.getItem('shiro_break_reminders') !== 'false',
    dailyReview: localStorage.getItem('shiro_daily_review_on') !== 'false',
  });

  // 4. Spaced Repetition State
  const [spacedRep, setSpacedRep] = useState({
    dailyReviewLimit: parseInt(localStorage.getItem('shiro_srs_daily_limit') || '20', 10),
    newCardsPerDay: parseInt(localStorage.getItem('shiro_srs_new_cards') || '10', 10),
    reviewAlgorithm: localStorage.getItem('shiro_srs_algo') || 'Adaptive SM-2',
    reviewReminders: localStorage.getItem('shiro_srs_reminders') !== 'false',
  });

  // 6. Notifications State
  const [notifications, setNotifications] = useState({
    studyReminders: localStorage.getItem('shiro_notif_study') !== 'false',
    dailyReviewReminder: localStorage.getItem('shiro_notif_review') !== 'false',
    studyStreakReminder: localStorage.getItem('shiro_notif_streak') !== 'false',
    quizResults: localStorage.getItem('shiro_notif_quiz') !== 'false',
    reminderTime: localStorage.getItem('shiro_notif_time') || '19:00',
    emailNotifications: localStorage.getItem('shiro_notif_email') === 'true',
  });


  // 7. Documents & Knowledge State
  const [docSettings, setDocSettings] = useState({
    autoEmbeddings: localStorage.getItem('shiro_doc_embeddings') !== 'false',
    generateSummary: localStorage.getItem('shiro_doc_summary') !== 'false',
    enableCitations: localStorage.getItem('shiro_doc_citations') !== 'false',
    citationPreference: localStorage.getItem('shiro_citation_format') || 'Page + document title',
  });

  // 8. Privacy & Data State
  const [privacy, setPrivacy] = useState({
    chatHistory: localStorage.getItem('shiro_save_chat_history') !== 'false',
    aiTraining: 'none', // Don't use my conversations
  });

  // 9. Personal BYOK API Keys State
  const [byokState, setByokState] = useState({
    has_groq_key: false,
    groq_masked: null,
    has_gemini_key: false,
    gemini_masked: null,
    has_openai_key: false,
    openai_masked: null,
    preferred_provider: 'auto',
    byok_enabled: true
  });
  const [byokInputs, setByokInputs] = useState({ groq: '', gemini: '', openai: '' });
  const [showKeys, setShowKeys] = useState({ groq: false, gemini: false, openai: false });
  const [testingKey, setTestingKey] = useState({ groq: false, gemini: false, openai: false });
  const [testResult, setTestResult] = useState({ groq: null, gemini: null, openai: null });
  const [savingKey, setSavingKey] = useState({ groq: false, gemini: false, openai: false });

  const fetchApiKeys = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api-keys`);
      if (res.ok) {
        const data = await res.json();
        setByokState(data);
      }
    } catch (e) {
      console.error("Failed to load BYOK API key config:", e);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const handleTestKey = async (provider) => {
    const key = byokInputs[provider]?.trim();
    if (!key) {
      toast.error(`Please enter a ${provider.toUpperCase()} API key to test`);
      return;
    }
    setTestingKey(prev => ({ ...prev, [provider]: true }));
    setTestResult(prev => ({ ...prev, [provider]: null }));
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api-keys/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, api_key: key })
      });
      const data = await res.json();
      if (data.valid) {
        setTestResult(prev => ({ ...prev, [provider]: { valid: true, message: 'Key verified successfully!' } }));
        toast.success(`${provider.toUpperCase()} key verified!`);
      } else {
        setTestResult(prev => ({ ...prev, [provider]: { valid: false, message: data.message || 'Invalid key' } }));
        toast.error(data.message || 'Key validation failed');
      }
    } catch (e) {
      setTestResult(prev => ({ ...prev, [provider]: { valid: false, message: 'Network or validation error' } }));
      toast.error('Failed to validate key');
    } finally {
      setTestingKey(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleSaveKey = async (provider) => {
    const key = byokInputs[provider]?.trim();
    if (!key) {
      toast.error(`Please enter a ${provider.toUpperCase()} API key`);
      return;
    }
    setSavingKey(prev => ({ ...prev, [provider]: true }));
    try {
      const payload = {
        [`${provider}_api_key`]: key,
        preferred_provider: byokState.preferred_provider,
        byok_enabled: byokState.byok_enabled
      };
      const res = await fetchWithAuth(`${API_BASE_URL}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setByokState(data);
        setByokInputs(prev => ({ ...prev, [provider]: '' }));
        setTestResult(prev => ({ ...prev, [provider]: null }));
        toast.success(`${provider.toUpperCase()} API key securely encrypted & saved!`);
      } else {
        toast.error('Failed to save API key');
      }
    } catch (e) {
      toast.error('Network error saving API key');
    } finally {
      setSavingKey(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider) => {
    if (!window.confirm(`Remove your personal ${provider.toUpperCase()} key? Your account will revert to Shiro's platform quota.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api-keys/${provider}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        setByokState(data);
        setByokInputs(prev => ({ ...prev, [provider]: '' }));
        setTestResult(prev => ({ ...prev, [provider]: null }));
        toast.success(`${provider.toUpperCase()} key removed.`);
      }
    } catch (e) {
      toast.error('Failed to remove API key');
    }
  };

  const handleSetPreferredProvider = async (provider) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferred_provider: provider,
          byok_enabled: byokState.byok_enabled
        })
      });
      if (res.ok) {
        const data = await res.json();
        setByokState(data);
        toast.success(`Preferred provider set to ${provider.toUpperCase()}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Subject Tag Helpers
  const handleAddSubject = () => {
    if (!newSubjectInput.trim()) return;
    if (profile.subjects.includes(newSubjectInput.trim())) {
      toast.error('Subject already added');
      return;
    }
    const updated = [...profile.subjects, newSubjectInput.trim()];
    setProfile({ ...profile, subjects: updated });
    setNewSubjectInput('');
    setShowAddSubject(false);
  };

  const handleRemoveSubject = (subToRemove) => {
    setProfile({
      ...profile,
      subjects: profile.subjects.filter(s => s !== subToRemove)
    });
  };

  // Master Save Handler
  const handleSaveAll = async () => {
    // 1. Profile - Update local state, AuthContext, and backend API
    const trimmedName = profile.name?.trim() || 'Scholar';
    localStorage.setItem('shiro_student_name', trimmedName);
    updateUser({ name: trimmedName });

    try {
      await fetchWithAuth(`${API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
    } catch (e) {
      console.error('Failed to sync profile with server:', e);
    }

    localStorage.setItem('shiro_learning_goal', profile.learningGoal);
    localStorage.setItem('shiro_current_level', profile.currentLevel);
    localStorage.setItem('shiro_subjects', JSON.stringify(profile.subjects));

    // 2. AI & Chat
    localStorage.setItem('shiro_default_mode', aiChat.defaultMode);
    localStorage.setItem('shiro_response_style', aiChat.responseStyle);
    localStorage.setItem('shiro_style_examples', aiChat.useExamples.toString());
    localStorage.setItem('shiro_style_terms', aiChat.explainDifficultTerms.toString());
    localStorage.setItem('shiro_style_followups', aiChat.askFollowUpQuestions.toString());
    localStorage.setItem('shiro_streaming', aiChat.streamingResponses.toString());
    localStorage.setItem('shiro_show_citations', aiChat.showCitations.toString());
    localStorage.setItem('shiro_syntax_highlight', aiChat.codeSyntaxHighlighting.toString());

    // 3. Study Preferences
    localStorage.setItem('shiro_daily_study_goal', studyPrefs.dailyStudyGoalMins.toString());
    localStorage.setItem('shiro_pref_study_time', studyPrefs.preferredStudyTime);
    localStorage.setItem('shiro_difficulty', studyPrefs.difficulty);
    localStorage.setItem('shiro_session_length', studyPrefs.sessionLength.toString());
    localStorage.setItem('shiro_break_reminders', studyPrefs.breakReminders.toString());
    localStorage.setItem('shiro_daily_review_on', studyPrefs.dailyReview.toString());

    // 4. Spaced Repetition
    localStorage.setItem('shiro_srs_daily_limit', spacedRep.dailyReviewLimit.toString());
    localStorage.setItem('shiro_srs_new_cards', spacedRep.newCardsPerDay.toString());
    localStorage.setItem('shiro_srs_algo', spacedRep.reviewAlgorithm);
    localStorage.setItem('shiro_srs_reminders', spacedRep.reviewReminders.toString());

    // 5. Appearance
    localStorage.setItem('shiro_accent_color', accent);
    localStorage.setItem('shiro_ui_density', density);
    localStorage.setItem('shiro_animations', animations ? 'full' : 'reduced');
    localStorage.setItem('shiro_font_scale', fontSize.toString());

    // 6. Notifications
    localStorage.setItem('shiro_notif_study', notifications.studyReminders.toString());
    localStorage.setItem('shiro_notif_review', notifications.dailyReviewReminder.toString());
    localStorage.setItem('shiro_notif_streak', notifications.studyStreakReminder.toString());
    localStorage.setItem('shiro_notif_quiz', notifications.quizResults.toString());
    localStorage.setItem('shiro_notif_time', notifications.reminderTime);
    localStorage.setItem('shiro_notif_email', notifications.emailNotifications.toString());

    // 7. Documents
    localStorage.setItem('shiro_doc_embeddings', docSettings.autoEmbeddings.toString());
    localStorage.setItem('shiro_doc_summary', docSettings.generateSummary.toString());
    localStorage.setItem('shiro_doc_citations', docSettings.enableCitations.toString());
    localStorage.setItem('shiro_citation_format', docSettings.citationPreference);

    // 8. Privacy
    localStorage.setItem('shiro_save_chat_history', privacy.chatHistory.toString());

    setSavedSuccess(true);
    toast.success('Preferences saved successfully!');
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleExportData = () => {
    const exportData = {
      user: { name: profile.name, email: profile.email },
      learningProfile: profile,
      aiPreferences: aiChat,
      studyPreferences: studyPrefs,
      spacedRepetition: spacedRep,
      appearance: { accent, density, animations, fontSize, theme },
      notifications,
      exportedAt: new Date().toISOString(),
      app: 'Shiro AI Learning OS'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shiro_study_profile_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Study profile exported.');
  };

  const handleClearHistory = () => {
    if (window.confirm('Delete all local chat history? Your uploaded documents and notes will remain intact.')) {
      localStorage.removeItem('shiro_chat_history');
      toast.success('Chat history cleared.');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'ai', label: 'AI & Chat', icon: Brain },
    { id: 'apikeys', label: 'AI API Keys', icon: Key },
    { id: 'study', label: 'Study Preferences', icon: Clock },
    { id: 'spaced', label: 'Spaced Repetition', icon: Layers },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'documents', label: 'Documents & Knowledge', icon: FileText },
    { id: 'privacy', label: 'Privacy & Data', icon: ShieldCheck },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Command },
    { id: 'about', label: 'About Shiro', icon: Info },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 pb-28 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-[#3F6048] dark:text-[#89A88D] mb-1 tracking-widest uppercase font-mono">
            <Sliders className="w-3.5 h-3.5" />
            <span>SHIRO LEARNING OS SETTINGS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Settings
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
            Personalize how Shiro teaches you, your study cadence, memory intervals, and privacy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveAll}
            icon={savedSuccess ? Check : Save}
          >
            {savedSuccess ? 'Saved' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Main Settings Body */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/20 dark:border-[#89A88D]/30 font-semibold shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#3F6048] dark:text-[#89A88D]' : 'text-[var(--text-muted)]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-medium text-[#C96B62] hover:bg-[#C96B62]/10 border border-[#C96B62]/20 transition-all text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Right Settings Content Panels */}
        <div className="md:col-span-3">
          <AnimatePresence mode="wait">
            {/* 1. PROFILE */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Student Profile"
                    subtitle="Personalize your identity and academic context for tailored AI recommendations"
                    icon={User}
                  />
                  <CardContent className="space-y-5 pt-2">
                    {/* User Identity Row */}
                    <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]">
                      <div className="w-14 h-14 rounded-2xl bg-[#3F6048]/15 dark:bg-[#89A88D]/20 border border-[#3F6048]/20 dark:border-[#89A88D]/30 p-0.5 shadow-sm shrink-0">
                        <div className="w-full h-full rounded-[14px] bg-[var(--bg-surface-elevated)] flex items-center justify-center overflow-hidden">
                          <img
                            src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile.email}`}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={profile.name}
                          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                          className="font-bold text-base text-[var(--text-main)] bg-transparent border-b border-dashed border-[var(--border)] focus:border-[#3F6048] focus:outline-none pb-0.5 font-serif"
                          placeholder="Your Name"
                        />
                        <p className="text-xs text-[var(--text-secondary)] mt-1">{profile.email}</p>
                      </div>
                    </div>

                    {/* Learning Goal */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Learning Goal
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['University', 'Competitive exams', 'School', 'Self-learning'].map((goal) => (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => setProfile({ ...profile, learningGoal: goal })}
                            className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all ${
                              profile.learningGoal === goal
                                ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold shadow-sm'
                                : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {goal}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Subjects Tag Chips */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Active Subjects & Domains
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {profile.subjects.map((subj) => (
                          <span
                            key={subj}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs font-medium text-[var(--text-main)] shadow-xs"
                          >
                            <span>{subj}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubject(subj)}
                              className="text-[var(--text-muted)] hover:text-[#C96B62] transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}

                        {showAddSubject ? (
                          <div className="inline-flex items-center gap-1.5 bg-[var(--bg-surface-elevated)] border border-[#3F6048] rounded-xl px-2 py-1">
                            <input
                              type="text"
                              autoFocus
                              value={newSubjectInput}
                              onChange={(e) => setNewSubjectInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddSubject()}
                              placeholder="e.g. Organic Chem"
                              className="text-xs bg-transparent text-[var(--text-main)] focus:outline-none w-28"
                            />
                            <button
                              type="button"
                              onClick={handleAddSubject}
                              className="text-xs font-bold text-[#3F6048] hover:text-[#2D4534]"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddSubject(false)}
                              className="text-[var(--text-muted)]"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowAddSubject(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#3F6048] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Subject</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Current Level */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Current Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setProfile({ ...profile, currentLevel: lvl })}
                            className={`py-2 px-3 rounded-xl border text-xs font-medium text-center transition-all ${
                              profile.currentLevel === lvl
                                ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold shadow-sm'
                                : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 2. AI & CHAT */}
            {activeTab === 'ai' && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="AI & Chat Preferences"
                    subtitle="Configure default pedagogical persona, response depth, and live streaming"
                    icon={Brain}
                  />
                  <CardContent className="space-y-5 pt-2">
                    {/* Default Mode */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Default AI Mode
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'tutor', label: 'Tutor Mode', desc: 'Socratic analogies & guided hints (Default)' },
                          { id: 'exam', label: 'Exam Mode', desc: 'Strict criteria & high-yield definitions' },
                          { id: 'feynman', label: 'Feynman Challenge', desc: 'Tests your understanding via plain English' }
                        ].map((m) => (
                          <div
                            key={m.id}
                            onClick={() => setAiChat({ ...aiChat, defaultMode: m.id })}
                            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                              aiChat.defaultMode === m.id
                                ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] shadow-sm'
                                : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#3F6048]/40'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-xs text-[var(--text-main)] font-serif">{m.label}</span>
                              {aiChat.defaultMode === m.id && <CheckCircle2 className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D]" />}
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{m.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Response Style */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Response Depth Style
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['concise', 'balanced', 'detailed'].map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => setAiChat({ ...aiChat, responseStyle: style })}
                            className={`py-2 px-3 rounded-xl border text-xs capitalize font-medium transition-all ${
                              aiChat.responseStyle === style
                                ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold shadow-sm'
                                : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                            }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Teaching Style Checkboxes */}
                    <div className="pt-3 border-t border-[var(--border)] space-y-3">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Teaching Style Elements
                      </label>
                      <div className="space-y-2.5">
                        {[
                          { key: 'useExamples', label: 'Use real-world intuitive examples', state: aiChat.useExamples },
                          { key: 'explainDifficultTerms', label: 'Explain difficult terms before using them', state: aiChat.explainDifficultTerms },
                          { key: 'askFollowUpQuestions', label: 'Ask follow-up questions to verify comprehension', state: aiChat.askFollowUpQuestions }
                        ].map((item) => (
                          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.state}
                              onChange={(e) => setAiChat({ ...aiChat, [item.key]: e.target.checked })}
                              className="w-4 h-4 rounded text-[#3F6048] accent-[#3F6048] bg-[var(--bg-surface-elevated)] border-[var(--border)] cursor-pointer"
                            />
                            <span className="text-xs text-[var(--text-main)]">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* System Toggles */}
                    <div className="pt-3 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-main)]">Streaming responses</span>
                        <input
                          type="checkbox"
                          checked={aiChat.streamingResponses}
                          onChange={(e) => setAiChat({ ...aiChat, streamingResponses: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-main)]">Show source citations</span>
                        <input
                          type="checkbox"
                          checked={aiChat.showCitations}
                          onChange={(e) => setAiChat({ ...aiChat, showCitations: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </div>
                      <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs font-medium text-[var(--text-main)]">Code syntax highlighting</span>
                        <input
                          type="checkbox"
                          checked={aiChat.codeSyntaxHighlighting}
                          onChange={(e) => setAiChat({ ...aiChat, codeSyntaxHighlighting: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 2.5. AI API KEYS (BYOK) */}
            {activeTab === 'apikeys' && (
              <motion.div
                key="apikeys"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="AI API Keys"
                    subtitle="Bring your own Groq, Gemini, or OpenAI key to use your provider's quota instead of Shiro's daily AI allowance"
                    icon={Key}
                  />
                  <CardContent className="space-y-6 pt-2">
                    
                    {/* Status & Quota Callout Banner */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          (byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && byokState.byok_enabled
                            ? "bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC]"
                            : "bg-[#D6A84F]/15 text-[#D6A84F]"
                        }`}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-[var(--text-main)]">
                              {(byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && byokState.byok_enabled
                                ? "Personal BYOK Quota Active"
                                : "Platform Daily Quota Active"}
                            </h4>
                            <Badge
                              variant={(byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && byokState.byok_enabled ? "sage" : "gold"}
                              size="sm"
                            >
                              {(byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && byokState.byok_enabled ? "Personal Keys" : "50 Req / Day"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            {(byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && byokState.byok_enabled
                              ? "AI requests use your personal provider keys directly, completely bypassing Shiro's platform daily limits."
                              : "You are currently using Shiro's shared platform quota. Configure your personal keys below for unlimited requests."}
                          </p>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      {(byokState.has_groq_key || byokState.has_gemini_key || byokState.has_openai_key) && (
                        <label className="flex items-center gap-2 cursor-pointer self-start sm:self-center shrink-0">
                          <span className="text-xs font-medium text-[var(--text-main)]">Enable BYOK</span>
                          <input
                            type="checkbox"
                            checked={byokState.byok_enabled}
                            onChange={(e) => {
                              const updated = e.target.checked;
                              setByokState(prev => ({ ...prev, byok_enabled: updated }));
                              fetchWithAuth(`${API_BASE_URL}/api-keys`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ preferred_provider: byokState.preferred_provider, byok_enabled: updated })
                              });
                              toast.success(updated ? "Personal BYOK keys enabled" : "Reverted to platform quota");
                            }}
                            className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                          />
                        </label>
                      )}
                    </div>

                    {/* Preferred Provider Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Preferred AI Provider
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {[
                          { id: 'auto', label: 'Auto (Recommended)', desc: 'Fastest with fallback' },
                          { id: 'groq', label: 'Groq Cloud', desc: 'Fast open-source models' },
                          { id: 'gemini', label: 'Google Gemini', desc: 'Multimodal & reasoning' },
                          { id: 'openai', label: 'OpenAI', desc: 'Advanced reasoning' }
                        ].map((prov) => {
                          const isSelected = byokState.preferred_provider === prov.id;
                          return (
                            <div
                              key={prov.id}
                              onClick={() => handleSetPreferredProvider(prov.id)}
                              className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] shadow-xs'
                                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#3F6048]/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-bold text-xs text-[var(--text-main)]">{prov.label}</span>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />}
                              </div>
                              <p className="text-[10px] text-[var(--text-secondary)]">{prov.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Provider Cards */}
                    <div className="space-y-4 pt-2">
                      {[
                        {
                          id: 'groq',
                          name: 'Groq Cloud',
                          desc: 'Ultra-low latency open-source model inference',
                          placeholder: 'gsk_••••••••••••••••••••••••••••••••••••',
                          consoleUrl: 'https://console.groq.com/keys',
                          hasKey: byokState.has_groq_key,
                          maskedKey: byokState.groq_masked
                        },
                        {
                          id: 'gemini',
                          name: 'Google Gemini',
                          desc: 'Multimodal comprehension and balanced scientific reasoning',
                          placeholder: 'AIzaSy••••••••••••••••••••••••••••••••••',
                          consoleUrl: 'https://aistudio.google.com/app/apikey',
                          hasKey: byokState.has_gemini_key,
                          maskedKey: byokState.gemini_masked
                        },
                        {
                          id: 'openai',
                          name: 'OpenAI',
                          desc: 'Advanced reasoning and problem solving',
                          placeholder: 'sk-proj-•••••••••••••••••••••••••••••••',
                          consoleUrl: 'https://platform.openai.com/api-keys',
                          hasKey: byokState.has_openai_key,
                          maskedKey: byokState.openai_masked
                        }
                      ].map((provider) => {
                        const isTesting = testingKey[provider.id];
                        const isSaving = savingKey[provider.id];
                        const result = testResult[provider.id];
                        const isRevealed = showKeys[provider.id];
                        const inputValue = byokInputs[provider.id];

                        return (
                          <div
                            key={provider.id}
                            className="p-5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-3.5"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-[var(--text-main)] font-serif">
                                    {provider.name}
                                  </h4>
                                  {provider.hasKey ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] font-semibold border border-[#3F6048]/30">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>{provider.maskedKey}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                      Not Configured
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                                  {provider.desc}
                                </p>
                              </div>

                              <a
                                href={provider.consoleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#3F6048] dark:text-[#89A88D] hover:underline shrink-0"
                              >
                                <span>Get API Key</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>

                            {/* Input Row */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                              <div className="relative flex-1">
                                <input
                                  type={isRevealed ? "text" : "password"}
                                  value={inputValue}
                                  onChange={(e) => setByokInputs({ ...byokInputs, [provider.id]: e.target.value })}
                                  placeholder={provider.hasKey ? "Enter new key to update..." : provider.placeholder}
                                  className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] font-mono focus:outline-none focus:border-[#3F6048]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowKeys({ ...showKeys, [provider.id]: !isRevealed })}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                >
                                  {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isTesting || !inputValue}
                                  onClick={() => handleTestKey(provider.id)}
                                >
                                  {isTesting ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Testing...</span>
                                    </>
                                  ) : (
                                    <span>Test Key</span>
                                  )}
                                </Button>

                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={isSaving || !inputValue}
                                  onClick={() => handleSaveKey(provider.id)}
                                >
                                  {isSaving ? "Saving..." : (provider.hasKey ? "Update" : "Save Key")}
                                </Button>

                                {provider.hasKey && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKey(provider.id)}
                                    title="Remove personal key"
                                    className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-[#C96B62] hover:border-[#C96B62]/40 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Test Result Feedback */}
                            {result && (
                              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                result.valid
                                  ? "bg-[#E8EFE9] dark:bg-[#89A88D]/15 border-[#3F6048]/30 text-[#3F6048] dark:text-[#A8C5AC]"
                                  : "bg-[#C96B62]/10 border-[#C96B62]/30 text-[#C96B62]"
                              }`}>
                                {result.valid ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                                <span>{result.message}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Security Explanation Callout */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-start gap-3 text-xs text-[var(--text-muted)]">
                      <Lock className="w-4 h-4 text-[#89A88D] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-[var(--text-main)] block">Server-Side AES-256 Encryption Guarantee</span>
                        <p className="leading-relaxed">
                          Your API keys are encrypted at rest using industry-standard symmetric AES-256 ciphers and decrypted only in-memory during authorized request processing. Shiro never exposes raw keys in responses or logs.
                        </p>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 3. STUDY PREFERENCES */}
            {activeTab === 'study' && (
              <motion.div
                key="study"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Study Preferences & Habits"
                    subtitle="Powers Shiro's 'What to Study Next' intelligence and Pomodoro rhythm"
                    icon={Clock}
                  />
                  <CardContent className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Daily Goal */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Daily Study Goal
                        </label>
                        <select
                          value={studyPrefs.dailyStudyGoalMins}
                          onChange={(e) => setStudyPrefs({ ...studyPrefs, dailyStudyGoalMins: parseInt(e.target.value, 10) })}
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                        >
                          <option value="30">30 Minutes / Day</option>
                          <option value="45">45 Minutes / Day</option>
                          <option value="60">60 Minutes / Day (Recommended)</option>
                          <option value="90">90 Minutes / Day</option>
                          <option value="120">120 Minutes / Day (Intensive)</option>
                        </select>
                      </div>

                      {/* Preferred Study Time */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Preferred Study Time
                        </label>
                        <select
                          value={studyPrefs.preferredStudyTime}
                          onChange={(e) => setStudyPrefs({ ...studyPrefs, preferredStudyTime: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                        >
                          <option value="Morning">Morning (8:00 AM - 12:00 PM)</option>
                          <option value="Afternoon">Afternoon (1:00 PM - 5:00 PM)</option>
                          <option value="Evening">Evening (6:00 PM - 10:00 PM)</option>
                          <option value="Night">Night Owl (10:00 PM - 2:00 AM)</option>
                        </select>
                      </div>

                      {/* Session Length */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Focus Block Length
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[25, 45, 60].map((len) => (
                            <button
                              key={len}
                              type="button"
                              onClick={() => setStudyPrefs({ ...studyPrefs, sessionLength: len })}
                              className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                                studyPrefs.sessionLength === len
                                  ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold shadow-sm'
                                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              {len} min
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Difficulty Level */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Curriculum Difficulty
                        </label>
                        <select
                          value={studyPrefs.difficulty}
                          onChange={(e) => setStudyPrefs({ ...studyPrefs, difficulty: e.target.value })}
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                        >
                          <option value="Adaptive">Adaptive (Auto adjusts with score)</option>
                          <option value="Standard">Standard Academic</option>
                          <option value="Challenging">Rigorous / Exam Grade</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border)] space-y-2.5">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">Break Reminders</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Prompt for a 5-minute stretch at session end</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={studyPrefs.breakReminders}
                          onChange={(e) => setStudyPrefs({ ...studyPrefs, breakReminders: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">Daily Review Check-in</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Generate evening 3-minute synthesis summary</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={studyPrefs.dailyReview}
                          onChange={(e) => setStudyPrefs({ ...studyPrefs, dailyReview: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 4. SPACED REPETITION */}
            {activeTab === 'spaced' && (
              <motion.div
                key="spaced"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Spaced Repetition & Flashcards"
                    subtitle="Control SM-2 memory intervals, review limits, and rating scale"
                    icon={Layers}
                  />
                  <CardContent className="space-y-5 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Daily Review Limit
                        </label>
                        <select
                          value={spacedRep.dailyReviewLimit}
                          onChange={(e) => setSpacedRep({ ...spacedRep, dailyReviewLimit: parseInt(e.target.value, 10) })}
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                        >
                          <option value="15">15 cards / day</option>
                          <option value="20">20 cards / day (Default)</option>
                          <option value="40">40 cards / day</option>
                          <option value="80">80 cards / day (Exam Sprint)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          New Cards Per Day
                        </label>
                        <select
                          value={spacedRep.newCardsPerDay}
                          onChange={(e) => setSpacedRep({ ...spacedRep, newCardsPerDay: parseInt(e.target.value, 10) })}
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                        >
                          <option value="5">5 new cards</option>
                          <option value="10">10 new cards (Balanced)</option>
                          <option value="20">20 new cards</option>
                        </select>
                      </div>
                    </div>

                    {/* Difficulty Ratings Preview */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Standard 4-Tier SM-2 Rating Scale
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="p-2.5 rounded-xl bg-[#F7E8E5] dark:bg-[#C96B62]/15 border border-[#C96B62]/30 text-center">
                          <span className="block text-xs font-bold text-[#9E352B] dark:text-[#E58B82]">Again (1)</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Reset interval</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#F4E9CC] dark:bg-[#D6A84F]/15 border border-[#E9D8AE] dark:border-[#D6A84F]/30 text-center">
                          <span className="block text-xs font-bold text-[#7B5E20] dark:text-[#E8C278]">Hard (2)</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Short step</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#E8EFE9] dark:bg-[#89A88D]/15 border border-[#3F6048]/20 dark:border-[#89A88D]/30 text-center">
                          <span className="block text-xs font-bold text-[#3F6048] dark:text-[#A8C5AC]">Good (3)</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Standard</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#3F6048] text-white text-center">
                          <span className="block text-xs font-bold">Easy (4)</span>
                          <span className="text-[10px] text-white/80">Multiplier</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border)]">
                      <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">Review Reminders</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Alert when flashcards are due to prevent memory decay</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={spacedRep.reviewReminders}
                          onChange={(e) => setSpacedRep({ ...spacedRep, reviewReminders: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 5. APPEARANCE */}
            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Appearance & Visuals"
                    subtitle="Theme modes, accent colors, spacing density, and reading typography"
                    icon={Palette}
                  />
                  <CardContent className="space-y-5 pt-2">
                    {/* Theme Mode */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Base Canvas Theme
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          onClick={() => setTheme('light')}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                            theme === 'light'
                              ? 'bg-[#E8EFE9] border-[#3F6048] shadow-sm'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#3F6048]/40'
                          }`}
                        >
                          <div>
                            <h4 className="text-xs md:text-sm font-bold text-[var(--text-main)] font-serif">Warm Ivory (Light)</h4>
                            <p className="text-[11px] text-[var(--text-secondary)]">Calm reading canvas & ink typography</p>
                          </div>
                          {theme === 'light' && <CheckCircle2 className="w-5 h-5 text-[#3F6048] shrink-0" />}
                        </div>

                        <div
                          onClick={() => setTheme('dark')}
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                            theme === 'dark'
                              ? 'bg-[#89A88D]/15 border-[#89A88D] shadow-sm'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#89A88D]/40'
                          }`}
                        >
                          <div>
                            <h4 className="text-xs md:text-sm font-bold text-[var(--text-main)] font-serif">Obsidian Slate (Dark)</h4>
                            <p className="text-[11px] text-[var(--text-secondary)]">Deep contrast for long nighttime sessions</p>
                          </div>
                          {theme === 'dark' && <CheckCircle2 className="w-5 h-5 text-[#89A88D] shrink-0" />}
                        </div>
                      </div>
                    </div>

                    {/* Accent Color */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Primary Editorial Accent
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { id: 'sage', label: 'Sage (Default)', hex: '#3F6048' },
                          { id: 'blue', label: 'Slate Blue', hex: '#4A6FA5' },
                          { id: 'rose', label: 'Terracotta', hex: '#C96B62' },
                          { id: 'amber', label: 'Soft Gold', hex: '#D6A84F' },
                        ].map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setAccent(acc.id)}
                            className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                              accent === acc.id
                                ? 'border-[#3F6048] bg-[var(--bg-surface-elevated)] font-bold shadow-xs'
                                : 'border-[var(--border)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)]'
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: acc.hex }} />
                            <span>{acc.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Layout Density */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          UI Density
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {['compact', 'comfortable', 'spacious'].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDensity(d)}
                              className={`py-2 rounded-xl border text-xs capitalize font-medium transition-all ${
                                density === d
                                  ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold'
                                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                          Interface Animations
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { key: true, label: 'On (Fluid)' },
                            { key: false, label: 'Reduced' }
                          ].map((an) => (
                            <button
                              key={an.label}
                              type="button"
                              onClick={() => setAnimations(an.key)}
                              className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                                animations === an.key
                                  ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[#3F6048] dark:text-[#A8C5AC] font-bold'
                                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {an.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Font Scale */}
                    <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-semibold text-[var(--text-main)] font-serif">Font Scale</label>
                        <span className="font-mono text-[var(--text-secondary)]">{fontSize}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[var(--text-muted)]">A−</span>
                        <input
                          type="range"
                          min="90"
                          max="115"
                          step="5"
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                          className="flex-1 accent-[#3F6048] cursor-pointer"
                        />
                        <span className="text-sm font-bold text-[var(--text-main)]">A+</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 6. NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Notifications & Alerts"
                    subtitle="Gentle study reminders designed for active recall, never spam"
                    icon={Bell}
                  />
                  <CardContent className="space-y-3 pt-2">
                    {[
                      { key: 'studyReminders', title: 'Study session reminders', desc: 'Alerts at your scheduled focus block' },
                      { key: 'dailyReviewReminder', title: 'Daily spaced review reminder', desc: 'Evening ping to clear today’s flashcard queue' },
                      { key: 'studyStreakReminder', title: 'Study streak protection', desc: 'Gentle notification before streak resets at midnight' },
                      { key: 'quizResults', title: 'Quiz & Feynman evaluation feedback', desc: 'Instant breakdown when AI finishes grading' }
                    ].map((item) => (
                      <label key={item.key} className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">{item.title}</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">{item.desc}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications[item.key]}
                          onChange={(e) => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </label>
                    ))}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)]">
                        <label className="text-xs font-semibold text-[var(--text-main)] font-serif block mb-1.5">
                          Daily Review Reminder Time
                        </label>
                        <input
                          type="time"
                          value={notifications.reminderTime}
                          onChange={(e) => setNotifications({ ...notifications, reminderTime: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-main)] font-mono"
                        />
                      </div>

                      <label className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between cursor-pointer">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">Email Notifications</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Weekly learning progress summaries</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.emailNotifications}
                          onChange={(e) => setNotifications({ ...notifications, emailNotifications: e.target.checked })}
                          className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                        />
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 7. DOCUMENTS & KNOWLEDGE */}
            {activeTab === 'documents' && (
              <motion.div
                key="documents"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Documents & Knowledge Base"
                    subtitle="Default ingestion settings, citation formats, and local storage usage"
                    icon={FileText}
                  />
                  <CardContent className="space-y-5 pt-2">
                    {/* Default Document Behavior */}
                    <div className="space-y-2.5">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Default Upload Ingestion Behavior
                      </label>
                      <div className="space-y-2">
                        {[
                          { key: 'autoEmbeddings', label: 'Automatically create vector embeddings on upload', state: docSettings.autoEmbeddings },
                          { key: 'generateSummary', label: 'Generate high-yield executive document summary', state: docSettings.generateSummary },
                          { key: 'enableCitations', label: 'Enable exact passage citation linking [CIT-n]', state: docSettings.enableCitations },
                        ].map((item) => (
                          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.state}
                              onChange={(e) => setDocSettings({ ...docSettings, [item.key]: e.target.checked })}
                              className="w-4 h-4 rounded accent-[#3F6048] cursor-pointer"
                            />
                            <span className="text-xs text-[var(--text-main)]">{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Citation Preference */}
                    <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                      <label className="text-xs font-semibold text-[var(--text-main)] font-serif block">
                        Citation Pill Preference
                      </label>
                      <select
                        value={docSettings.citationPreference}
                        onChange={(e) => setDocSettings({ ...docSettings, citationPreference: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] cursor-pointer"
                      >
                        <option value="Page + document title">Page number + document title (e.g. [Biology Ch.4, p.12])</option>
                        <option value="Short index">Short index badge (e.g. [CIT-1])</option>
                        <option value="Author date">Academic Author-Date format</option>
                      </select>
                    </div>

                    {/* Storage Meter */}
                    <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-medium text-[var(--text-main)]">
                          <HardDrive className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D]" />
                          <span>Knowledge Storage Allocated</span>
                        </div>
                        <span className="font-mono text-[var(--text-secondary)]">18 documents • 642 MB</span>
                      </div>
                      <div className="w-full bg-[var(--bg-surface)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                        <div className="bg-[#3F6048] dark:bg-[#89A88D] h-full rounded-full w-[24%]" />
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)] block">24% of standard local quota used</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 8. PRIVACY & DATA */}
            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Privacy, Data & Account Control"
                    subtitle="Complete transparency over your study conversations, documents, and data retention"
                    icon={ShieldCheck}
                  />
                  <CardContent className="space-y-4 pt-2">
                    <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[var(--text-main)] block">Chat History Retention</span>
                        <span className="text-[11px] text-[var(--text-secondary)]">Save previous sessions for contextual follow-ups</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={privacy.chatHistory}
                        onChange={(e) => setPrivacy({ ...privacy, chatHistory: e.target.checked })}
                        className="w-4 h-4 accent-[#3F6048] cursor-pointer"
                      />
                    </div>

                    <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-[var(--text-main)] block">AI Model Training</span>
                        <span className="text-[11px] text-[var(--text-secondary)]">Your study notes and conversations are never used for public training</span>
                      </div>
                      <Badge variant="sage" size="sm">Private & Protected</Badge>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-[var(--border)] space-y-3">
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)]">
                        <div>
                          <span className="text-xs font-semibold text-[var(--text-main)] block">Export My Data</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Download all notes, flashcards, and preferences in JSON format</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleExportData} icon={Download}>
                          Export
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7E8E5] dark:bg-[#C96B62]/10 border border-[#C96B62]/30">
                        <div>
                          <span className="text-xs font-semibold text-[#9E352B] dark:text-[#E58B82] block">Delete Chat History</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">Clear all chat streams while preserving documents</span>
                        </div>
                        <Button variant="danger" size="sm" onClick={handleClearHistory} icon={Trash2}>
                          Delete Chats
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 9. KEYBOARD SHORTCUTS */}
            {activeTab === 'shortcuts' && (
              <motion.div
                key="shortcuts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardHeader
                    title="Keyboard Shortcuts"
                    subtitle="Boost your study productivity with lightning-fast keyboard navigation"
                    icon={Command}
                  />
                  <CardContent className="space-y-5 pt-2">
                    {/* General / Navigation */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                        Chat & Navigation
                      </h4>
                      <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg-surface-elevated)]">
                        {[
                          { action: 'Open Command Palette / Search', key: '⌘ K / Ctrl + K' },
                          { action: 'Quick Search Documents', key: '⌘ / / Ctrl + /' },
                          { action: 'Send Message', key: 'Enter' },
                          { action: 'Insert New Line', key: 'Shift + Enter' },
                          { action: 'Focus Prompt Composer', key: '/' },
                        ].map((s) => (
                          <div key={s.action} className="p-3 flex items-center justify-between text-xs">
                            <span className="text-[var(--text-main)] font-medium">{s.action}</span>
                            <kbd className="px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-[11px] font-bold text-[var(--text-secondary)] shadow-xs">
                              {s.key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Flashcards */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                        Flashcard Studio (SM-2)
                      </h4>
                      <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--bg-surface-elevated)]">
                        {[
                          { action: 'Flip 3D Card', key: 'Space' },
                          { action: 'Rate: Again (1)', key: '1' },
                          { action: 'Rate: Hard (2)', key: '2' },
                          { action: 'Rate: Good (3)', key: '3' },
                          { action: 'Rate: Easy (4)', key: '4' },
                        ].map((s) => (
                          <div key={s.action} className="p-3 flex items-center justify-between text-xs">
                            <span className="text-[var(--text-main)] font-medium">{s.action}</span>
                            <kbd className="px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-[11px] font-bold text-[var(--text-secondary)] shadow-xs">
                              {s.key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* 10. ABOUT SHIRO */}
            {activeTab === 'about' && (
              <motion.div
                key="about"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <Card className="border-[var(--border)] bg-[var(--bg-surface)]">
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-3xl bg-[#3F6048]/15 dark:bg-[#89A88D]/20 border border-[#3F6048]/20 dark:border-[#89A88D]/30 flex items-center justify-center mx-auto text-[#3F6048] dark:text-[#89A88D] shadow-sm">
                      <Sparkles className="w-8 h-8" />
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold text-[var(--text-main)] font-serif">Shiro AI</h2>
                      <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">Version 1.0.0 (Editorial Release)</p>
                      <p className="text-sm text-[var(--text-main)] mt-2 max-w-md mx-auto italic font-serif">
                        "Calm, high-yield academic intelligence designed for deep learning, active recall, and focus."
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-4 text-xs text-[var(--text-secondary)] pt-4 border-t border-[var(--border)]">
                      <a href="#help" className="hover:text-[#3F6048] transition-colors">Help Center</a>
                      <span>•</span>
                      <a href="#feedback" className="hover:text-[#3F6048] transition-colors">Send Feedback</a>
                      <span>•</span>
                      <a href="#report" className="hover:text-[#3F6048] transition-colors">Report a Problem</a>
                      <span>•</span>
                      <a href="#privacy" className="hover:text-[#3F6048] transition-colors">Privacy Policy</a>
                      <span>•</span>
                      <a href="#terms" className="hover:text-[#3F6048] transition-colors">Terms of Service</a>
                    </div>

                    <div className="pt-2 text-[11px] text-[var(--text-muted)] font-mono">
                      Made for learning.
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
