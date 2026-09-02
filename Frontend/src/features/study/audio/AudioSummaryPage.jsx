import { fetchWithAuth } from '../../../api/fetchWithAuth';
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { usePodcasts } from "../../../context/PodcastContext";
import API_BASE_URL from "../../../api/config.js";

const AudioSummaryPage = () => {
  const { user } = useAuth();
  const { savePodcast } = usePodcasts();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [topic, setTopic] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [episodes, setEpisodes] = useState(1);
  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("dialogue"); // "dialogue" | "narrator"
  const [duration, setDuration] = useState("standard"); // "quick" | "standard" | "masterclass"
  const [narratorVoice, setNarratorVoice] = useState("en-US-AndrewNeural");
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Audio player states & speed controls
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState({});
  const audioRefs = useRef({});

  // Continue Listening / Resume State
  const [resumeData, setResumeData] = useState(null);

  // Subject folder UI state
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // Load resume data on mount
  useEffect(() => {
    try {
      const savedResume = localStorage.getItem("shiro_audio_resume");
      if (savedResume) {
        setResumeData(JSON.parse(savedResume));
      }
    } catch (e) {
      console.warn("Failed to parse resume data:", e);
    }
  }, []);

  // Fetch available documents
  const fetchDocuments = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch user podcasts
  const fetchPodcasts = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/podcasts`);
      if (response.ok) {
        const data = await response.json();
        setPodcasts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user && user.id) {
      fetchDocuments();
      fetchPodcasts();
    }
  }, [user]);

  // Poll task status with immediate termination on failure
  useEffect(() => {
    if (taskId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetchWithAuth(`${API_BASE_URL}/podcast-status/${taskId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.status === "completed") {
              setStatus("completed");
              setLoading(false);
              clearInterval(interval);
              fetchPodcasts();
            } else if (data.status === "failed" || (data.status && data.status.startsWith("failed"))) {
              setStatus("failed");
              setError(data.error || "We couldn't synthesize the audio production. Please try generating it again.");
              setLoading(false);
              clearInterval(interval);
              fetchPodcasts();
            } else {
              setStatus(data.status);
            }
          }
        } catch (err) {
          clearInterval(interval);
          setLoading(false);
          setStatus("failed");
          setError("Network connection interrupted while checking status.");
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [taskId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || selectedDocumentIds.length === 0) return;
    setLoading(true);
    setError(null);
    setStatus(null);
    setTaskId(null);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/generate-podcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          document_ids: selectedDocumentIds.map(Number),
          topic: topic || null,
          custom_title: customTitle.trim() || null,
          subject: subject.trim() || null,
          episodes: Number.isInteger(episodes) ? episodes : 1,
          duration: duration || "standard",
          language: language || "en",
          mode: mode,
          narrator_voice: mode === "narrator" ? narratorVoice : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to start podcast generation.");
      const data = await response.json();
      setTaskId(data.task_id);
      setStatus("processing");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDelete = async (podcastId) => {
    if (!window.confirm("Are you sure you want to delete this audio series?")) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/podcasts/${podcastId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        if (currentlyPlaying && currentlyPlaying.startsWith(podcastId)) {
          setCurrentlyPlaying(null);
          setPlayingEpisode(null);
        }
        if (resumeData && resumeData.seriesId === podcastId) {
          localStorage.removeItem("shiro_audio_resume");
          setResumeData(null);
        }
        fetchPodcasts();
      }
    } catch (err) {
      console.error("Failed to delete podcast:", err);
    }
  };

  const playEpisode = (podcastId, episodeIndex, startTime = 0) => {
    const audioKey = `${podcastId}-${episodeIndex}`;
    if (currentlyPlaying && audioRefs.current[currentlyPlaying] && currentlyPlaying !== audioKey) {
      audioRefs.current[currentlyPlaying].pause();
    }
    const audioEl = audioRefs.current[audioKey];
    if (audioEl) {
      const speed = playbackSpeed[audioKey] || 1.0;
      audioEl.playbackRate = speed;
      if (startTime > 0) {
        audioEl.currentTime = startTime;
      }
      audioEl.play().then(() => {
        setCurrentlyPlaying(audioKey);
        setPlayingEpisode({ podcastId, episodeIndex });
      }).catch(err => console.warn("Playback error:", err));
    }
  };

  const pauseEpisode = (podcastId, episodeIndex) => {
    const audioKey = `${podcastId}-${episodeIndex}`;
    if (audioRefs.current[audioKey]) {
      audioRefs.current[audioKey].pause();
      setCurrentlyPlaying(null);
      setPlayingEpisode(null);
    }
  };

  const handleSpeedChange = (audioKey, speed) => {
    setPlaybackSpeed(prev => ({ ...prev, [audioKey]: speed }));
    const audioEl = audioRefs.current[audioKey];
    if (audioEl) {
      audioEl.playbackRate = speed;
    }
  };

  const handleTimeUpdate = (podcast, ep, idx) => {
    const audioKey = `${podcast.id}-${idx}`;
    const audioEl = audioRefs.current[audioKey];
    if (!audioEl) return;

    const cur = audioEl.currentTime;
    const dur = audioEl.duration || ep.duration_seconds || 1;
    if (cur > 2) {
      const curM = Math.floor(cur / 60);
      const curS = Math.floor(cur % 60);
      const curFormatted = `${curM.toString().padStart(2, '0')}:${curS.toString().padStart(2, '0')}`;
      
      const newResume = {
        seriesId: podcast.id,
        seriesTitle: podcast.title || `Series #${podcast.id.slice(0, 8)}`,
        subject: podcast.subject || "General",
        episodeIndex: idx,
        episodeTitle: ep.title || `Episode ${idx + 1}`,
        currentTime: cur,
        duration: dur,
        currentTimeFormatted: curFormatted,
        durationFormatted: ep.duration_formatted || "00:00",
        lastPlayedAt: Date.now(),
      };
      setResumeData(newResume);
      try {
        localStorage.setItem("shiro_audio_resume", JSON.stringify(newResume));
      } catch (e) {}
    }
  };

  const handleEpisodeEnded = (podcast, idx) => {
    // Autoplay next episode in series if available!
    const nextIdx = idx + 1;
    if (nextIdx < podcast.episodes.length) {
      playEpisode(podcast.id, nextIdx);
    } else {
      setCurrentlyPlaying(null);
      setPlayingEpisode(null);
    }
  };

  const handleResume = () => {
    if (!resumeData) return;
    playEpisode(resumeData.seriesId, resumeData.episodeIndex, resumeData.currentTime);
  };

  const toggleFolder = (subjName) => {
    setCollapsedFolders(prev => ({ ...prev, [subjName]: !prev[subjName] }));
  };

  const isPlaying = (podcastId, episodeIndex) => {
    return playingEpisode?.podcastId === podcastId && playingEpisode?.episodeIndex === episodeIndex;
  };

  // Group podcasts by subject
  const groupedPodcasts = podcasts.reduce((acc, p) => {
    const subj = p.subject || "General";
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(p);
    return acc;
  }, {});

  const subjectList = Object.keys(groupedPodcasts).sort();
  const filteredSubjects = selectedSubjectFilter === "all"
    ? subjectList
    : subjectList.filter(s => s === selectedSubjectFilter);

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 font-body">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#3F6048] dark:text-[#89A88D] font-mono uppercase tracking-wider mb-1">
            <span className="material-symbols-outlined text-base">podcasts</span>
            <span>SHIRO AUDIO LAB</span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[var(--text-main)] mb-1 flex items-center gap-3">
            AI Audio Cast & Audiobooks
          </h1>
          <p className="text-[var(--text-secondary)] text-xs sm:text-sm max-w-2xl leading-relaxed">
            Convert study materials into bingeable, broadcast-quality audio series. Choose pacing from quick revisions to academic masterclasses, and explore your personal audio library.
          </p>
        </div>
      </section>

      {/* Continue Listening / Resume Banner */}
      {resumeData && (
        <section className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-[#3F6048]/15 via-[var(--bg-surface-elevated)] to-[var(--bg-surface)] border border-[#3F6048]/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#3F6048] dark:bg-[#89A88D] text-white dark:text-black flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-2xl animate-pulse">graphic_eq</span>
            </div>
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#3F6048]/20 text-[#3F6048] dark:text-[#A8C5AC] text-[9px] font-bold uppercase tracking-wider">
                  {resumeData.subject}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono font-medium">
                  {resumeData.currentTimeFormatted} / {resumeData.durationFormatted}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[var(--text-main)] truncate font-serif">
                {resumeData.seriesTitle} — <span className="font-normal text-[var(--text-secondary)]">{resumeData.episodeTitle}</span>
              </h3>
            </div>
          </div>
          <button
            onClick={handleResume}
            className="self-start sm:self-center px-4 py-2.5 rounded-xl bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0"
          >
            <span className="material-symbols-outlined text-base fill">play_arrow</span>
            <span>Continue Listening</span>
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Audio Cast Production Form */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-card p-6 sm:p-7 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] relative overflow-hidden shadow-sm space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2 font-serif border-b border-[var(--border)] pb-3">
              <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">mic</span>
              New Audio Production
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
              {/* Document Selection */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                  Source Documents
                </label>
                <div className="relative">
                  <select
                    multiple
                    value={selectedDocumentIds.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, opt => opt.value);
                      setSelectedDocumentIds(selected);
                      // Auto-fill subject from first doc if not yet set
                      if (!subject && selected.length > 0) {
                        const firstDoc = documents.find(d => String(d.id) === selected[0]);
                        if (firstDoc?.subject) setSubject(firstDoc.subject);
                      }
                    }}
                    required
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none min-h-[90px] custom-scrollbar"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id} className="py-1.5 px-2 rounded-lg cursor-pointer bg-[var(--bg-surface)] text-[var(--text-main)]">
                        📄 {doc.filename} {doc.subject ? `(${doc.subject})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] italic">Hold Ctrl/Cmd to select multiple files.</span>
              </div>

              {/* Audio Format: Dual-Host vs Solo Narrator */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                  Audio Format & Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("dialogue")}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      mode === "dialogue"
                        ? "bg-[#3F6048]/15 border-[#3F6048] text-[var(--text-main)] shadow-xs"
                        : "bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>🎧 Dual-Host Podcast</span>
                      {mode === "dialogue" && <span className="w-2 h-2 rounded-full bg-[#3F6048]"></span>}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Pocket FM style: Andrew & Ava lively studio dialogue
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("narrator")}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                      mode === "narrator"
                        ? "bg-[#3F6048]/15 border-[#3F6048] text-[var(--text-main)] shadow-xs"
                        : "bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span>📖 Solo Audiobook</span>
                      {mode === "narrator" && <span className="w-2 h-2 rounded-full bg-[#3F6048]"></span>}
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Kuku FM / GIGL style: Continuous narrative storytelling
                    </span>
                  </button>
                </div>
              </div>

              {/* If Solo Narrator, allow selecting Voice */}
              {mode === "narrator" && (
                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)]">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    Narrator Voice
                  </label>
                  <select
                    value={narratorVoice}
                    onChange={(e) => setNarratorVoice(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-2 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none font-medium"
                  >
                    <option value="en-US-AndrewNeural">Andrew (Warm Academic Professor)</option>
                    <option value="en-US-AvaNeural">Ava (Smooth & Patient Educator)</option>
                  </select>
                </div>
              )}

              {/* Friendly Duration Selector (P0 Requirement) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                  Episode Duration & Pacing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "quick", icon: "bolt", title: "Quick", time: "3–5 min", desc: "Quick revision" },
                    { id: "standard", icon: "track_changes", title: "Standard", time: "8–12 min", desc: "Regular study" },
                    { id: "masterclass", icon: "menu_book", title: "Masterclass", time: "15–20 min", desc: "Deep walkthrough" },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setDuration(tier.id)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col gap-0.5 transition-all ${
                        duration === tier.id
                          ? "bg-[#3F6048]/15 border-[#3F6048] text-[var(--text-main)] shadow-xs"
                          : "bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="material-symbols-outlined text-sm text-[#3F6048] dark:text-[#89A88D]">
                          {tier.icon}
                        </span>
                        {duration === tier.id && <span className="w-1.5 h-1.5 rounded-full bg-[#3F6048]"></span>}
                      </div>
                      <span className="font-bold text-xs text-[var(--text-main)]">{tier.title}</span>
                      <span className="text-[10px] font-semibold text-[#3F6048] dark:text-[#A8C5AC]">{tier.time}</span>
                      <span className="text-[9px] text-[var(--text-muted)] leading-tight">{tier.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Title & Subject Folder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                    Series Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g. Operating Systems: Deep Dive"
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                    Subject Folder
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Computer Science, Physics"
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                  />
                </div>
              </div>

              {/* Episodes & Language */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Episodes</label>
                  <input
                    type="number"
                    value={episodes}
                    onChange={(e) => setEpisodes(e.target.value)}
                    min="1" max="5" required
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              {/* Focus Angle */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
                  Focus Theme / Angle (Optional)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Focus on practical engineering trade-offs..."
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || selectedDocumentIds.length === 0}
                className="w-full py-3 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white text-xs font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><span className="material-symbols-outlined text-sm animate-spin">sync</span> Planning & Synthesizing Audio Production...</>
                ) : (
                  <><span className="material-symbols-outlined text-base fill">play_arrow</span> Generate Audio Series</>
                )}
              </button>
              
              {status && status !== "completed" && status !== "failed" && (
                <div className="p-3 bg-[#E8EFE9] dark:bg-[#89A88D]/15 border border-[#3F6048]/30 rounded-xl flex items-center gap-3 text-[#3F6048] dark:text-[#A8C5AC] text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse"></span>
                  Status: {status}
                </div>
              )}
              {status === "failed" && (
                <div className="p-4 bg-[#C96B62]/10 border border-[#C96B62]/30 rounded-2xl flex flex-col gap-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-[#C96B62] font-bold text-xs">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>Podcast Generation Failed</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {error || "We couldn't synthesize the audio production. Please try generating it again."}
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="self-center px-3.5 py-1.5 rounded-xl bg-[#C96B62] text-white text-xs font-semibold hover:bg-[#b05a52] transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span>
                    <span>Try Again</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Right Column: Library Organized by Subject Folders & List View */}
        <section className="lg:col-span-7 flex flex-col gap-5">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
             <h2 className="text-lg font-bold text-[var(--text-main)] tracking-tight flex items-center gap-2.5 font-serif">
               <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">folder_open</span>
               Audio Library by Subject
             </h2>
             <span className="text-xs text-[var(--text-muted)] font-mono">
               {podcasts.length} Series • {subjectList.length} Folders
             </span>
           </div>

           {/* Subject Filter Tabs */}
           {subjectList.length > 1 && (
             <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
               <button
                 onClick={() => setSelectedSubjectFilter("all")}
                 className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                   selectedSubjectFilter === "all"
                     ? "bg-[#3F6048] text-white shadow-2xs"
                     : "bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border)]"
                 }`}
               >
                 All Subjects ({podcasts.length})
               </button>
               {subjectList.map((subj) => (
                 <button
                   key={subj}
                   onClick={() => setSelectedSubjectFilter(subj)}
                   className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                     selectedSubjectFilter === subj
                       ? "bg-[#3F6048] text-white shadow-2xs"
                       : "bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border)]"
                   }`}
                 >
                   📁 {subj} ({groupedPodcasts[subj]?.length || 0})
                 </button>
               ))}
             </div>
           )}

           {podcasts.length === 0 ? (
             <div className="glass-card p-12 rounded-3xl border border-[var(--border)] border-dashed bg-[var(--bg-surface)] flex flex-col items-center justify-center text-center">
               <span className="material-symbols-outlined text-5xl mb-3 text-[var(--text-muted)] opacity-60">podcasts</span>
               <h3 className="text-base font-bold text-[var(--text-main)] mb-1 font-serif">Your Library is Empty</h3>
               <p className="text-[var(--text-secondary)] text-xs max-w-sm">
                 Select source documents, set your duration and audio style, and generate your first audio series.
               </p>
             </div>
           ) : (
             <div className="flex flex-col gap-6">
                {filteredSubjects.map((subjName) => {
                  const seriesList = groupedPodcasts[subjName] || [];
                  const isCollapsed = !!collapsedFolders[subjName];

                  return (
                    <div key={subjName} className="flex flex-col gap-3">
                      {/* Folder Header */}
                      <button
                        type="button"
                        onClick={() => toggleFolder(subjName)}
                        className="w-full p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between hover:border-[#3F6048]/40 transition-all text-left shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-xl text-[#3F6048] dark:text-[#89A88D]">
                            {isCollapsed ? 'folder' : 'folder_open'}
                          </span>
                          <span className="font-serif font-bold text-sm text-[var(--text-main)]">
                            {subjName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-mono font-bold text-[var(--text-muted)] border border-[var(--border)]">
                            {seriesList.length} {seriesList.length === 1 ? 'Series' : 'Series'}
                          </span>
                        </div>
                        <span className="material-symbols-outlined text-base text-[var(--text-muted)] transition-transform duration-200">
                          {isCollapsed ? 'expand_more' : 'expand_less'}
                        </span>
                      </button>

                      {/* Folder Contents (Series Cards) */}
                      {!isCollapsed && (
                        <div className="flex flex-col gap-4 pl-2 sm:pl-3 border-l-2 border-[#3F6048]/20 ml-3">
                          {seriesList.map((podcast) => {
                            const isProcessing = podcast.status === "processing";
                            const isFailed = podcast.status.startsWith("failed");

                            return (
                              <div key={podcast.id} className="glass-card rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden shadow-xs hover:border-[#3F6048]/40 transition-all">
                                {/* Series Header */}
                                <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="px-2 py-0.5 bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] text-[9px] font-bold uppercase tracking-wider rounded-full border border-[#3F6048]/30">
                                        Series
                                      </span>
                                      <span className="text-[10px] text-[var(--text-muted)] font-mono">ID: {podcast.id.split('-')[0]}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-[var(--text-main)] font-serif">
                                      {podcast.title || `Study Series based on Doc #${podcast.document_id}`}
                                    </h3>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {podcast.status === "completed" && podcast.episodes?.length > 0 && (
                                      <>
                                        <button
                                          onClick={() => playEpisode(podcast.id, 0)}
                                          className="px-3 py-1.5 rounded-xl bg-[#3F6048] text-white hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                                          title="Play from Episode 1"
                                        >
                                          <span className="material-symbols-outlined text-sm fill">play_arrow</span>
                                          <span>Play All</span>
                                        </button>
                                        <button onClick={() => savePodcast(podcast)} className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[#E8EFE9] text-[var(--text-secondary)] hover:text-[#3F6048] transition-all border border-[var(--border)]" title="Bookmark Series">
                                          <span className="material-symbols-outlined text-sm">bookmark</span>
                                        </button>
                                      </>
                                    )}
                                    <button onClick={() => handleDelete(podcast.id)} className="w-8 h-8 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[#C96B62]/15 text-[var(--text-muted)] hover:text-[#C96B62] transition-all border border-[var(--border)]" title="Delete Series">
                                      <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Series Body: File / Track List */}
                                <div className="p-4 sm:p-5">
                                  {isProcessing ? (
                                    <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-85">
                                      <div className="w-8 h-8 border-3 border-[#3F6048]/30 border-t-[#3F6048] rounded-full animate-spin"></div>
                                      <p className="text-xs font-bold text-[#3F6048] dark:text-[#89A88D] animate-pulse tracking-widest uppercase font-mono">
                                        Synthesizing Neural Speech Production...
                                      </p>
                                    </div>
                                  ) : isFailed ? (
                                    <div className="p-4 bg-[#C96B62]/10 text-[#C96B62] rounded-xl text-xs border border-[#C96B62]/30 text-center">
                                      ⚠️ Failed to generate audio. Please try generating again.
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-[var(--border)]/60">
                                      {podcast.episodes.map((rawEp, idx) => {
                                        // Normalize legacy string or new object format
                                        const isLegacy = typeof rawEp === "string";
                                        const ep = isLegacy ? {
                                          ep_number: idx + 1,
                                          title: `Episode ${idx + 1}: Deep Dive`,
                                          audio_url: rawEp,
                                          duration_formatted: "Standard",
                                          summary: ""
                                        } : rawEp;

                                        const audioKey = `${podcast.id}-${idx}`;
                                        const audioSrc = ep.audio_url?.startsWith("http")
                                          ? ep.audio_url
                                          : `${API_BASE_URL}/static/${ep.audio_url?.split('/').pop() || `${podcast.id}_ep${idx+1}.mp3`}`;
                                        
                                        const isEpPlaying = isPlaying(podcast.id, idx);
                                        const currentSpeed = playbackSpeed[audioKey] || 1.0;

                                        return (
                                          <div key={idx} className={`py-3.5 px-3 rounded-2xl transition-all flex flex-col gap-2.5 ${isEpPlaying ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/15 shadow-2xs' : 'hover:bg-[var(--bg-surface-elevated)]/60'}`}>
                                            {/* Track Row: Index, Title, Duration, Controls */}
                                            <div className="flex items-center justify-between gap-3">
                                              <div className="flex items-center gap-3 min-w-0">
                                                {/* Play / Pause Pill Button */}
                                                <button
                                                  onClick={() => isEpPlaying ? pauseEpisode(podcast.id, idx) : playEpisode(podcast.id, idx)}
                                                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                                                    isEpPlaying
                                                      ? 'bg-[#3F6048] text-white shadow-sm'
                                                      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[#E8EFE9] border border-[var(--border)]'
                                                  }`}
                                                  title={isEpPlaying ? "Pause" : "Play Episode"}
                                                >
                                                  <span className="material-symbols-outlined text-lg fill">
                                                    {isEpPlaying ? 'pause' : 'play_arrow'}
                                                  </span>
                                                </button>

                                                {/* Track Number & Title */}
                                                <div className="min-w-0">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold text-[#3F6048] dark:text-[#A8C5AC]">
                                                      {String(idx + 1).padStart(2, '0')}.
                                                    </span>
                                                    <h4 className={`text-xs sm:text-sm font-bold truncate ${isEpPlaying ? 'text-[#3F6048] dark:text-[#A8C5AC]' : 'text-[var(--text-main)]'}`}>
                                                      {ep.title || `Episode ${idx + 1}`}
                                                    </h4>
                                                  </div>
                                                  {ep.summary && (
                                                    <p className="text-[10px] text-[var(--text-secondary)] truncate max-w-md">
                                                      {ep.summary}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Right side: Measured Duration & Download */}
                                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                                <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[10px] font-mono font-bold text-[var(--text-secondary)] border border-[var(--border)]">
                                                  {ep.duration_formatted || "Audio"}
                                                </span>
                                                <a
                                                  href={audioSrc}
                                                  download={`Shiro_${podcast.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Series'}_Ep${idx + 1}.mp3`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="w-8 h-8 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[#E8EFE9] text-[var(--text-secondary)] hover:text-[#3F6048] flex items-center justify-center transition-all"
                                                  title="Download Episode MP3"
                                                >
                                                  <span className="material-symbols-outlined text-sm">download</span>
                                                </a>
                                              </div>
                                            </div>

                                            {/* Native Audio Element with Autoplay & Progress events */}
                                            <audio
                                              ref={(ref) => { if (ref) audioRefs.current[audioKey] = ref; }}
                                              src={audioSrc}
                                              onPlay={() => { setCurrentlyPlaying(audioKey); setPlayingEpisode({ podcastId: podcast.id, episodeIndex: idx }); }}
                                              onPause={() => { if (currentlyPlaying === audioKey) { setCurrentlyPlaying(null); setPlayingEpisode(null); } }}
                                              onTimeUpdate={() => handleTimeUpdate(podcast, ep, idx)}
                                              onEnded={() => handleEpisodeEnded(podcast, idx)}
                                              className="w-full h-8 filter opacity-80 hover:opacity-100 transition-opacity"
                                              controls
                                            />

                                            {/* Speed Adjustment Bar */}
                                            <div className="flex items-center justify-between pt-1 text-xs">
                                              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">speed</span> Speed:
                                              </span>
                                              <div className="flex items-center gap-1">
                                                {[0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => {
                                                  const isCurrent = currentSpeed === spd;
                                                  return (
                                                    <button
                                                      key={spd}
                                                      type="button"
                                                      onClick={() => handleSpeedChange(audioKey, spd)}
                                                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold transition-all ${
                                                        isCurrent
                                                          ? 'bg-[#3F6048] text-white shadow-2xs'
                                                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border)]'
                                                      }`}
                                                    >
                                                      {spd}x
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
             </div>
           )}
        </section>
      </div>
    </div>
  );
};

export default AudioSummaryPage;
