import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePodcasts } from "../../context/PodcastContext";
import API_BASE_URL from "../../api/config.js";

const AudioSummaryPage = () => {
  const { user } = useAuth();
  const { savePodcast } = usePodcasts();
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [topic, setTopic] = useState("");
  const [episodes, setEpisodes] = useState(1);
  const [language, setLanguage] = useState("en");
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Audio player states
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [playingEpisode, setPlayingEpisode] = useState(null);
  const audioRefs = useRef({});

  // Function to fetch available documents
  const fetchDocuments = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Function to fetch user podcasts
  const fetchPodcasts = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/podcasts/${user.id}`);
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

  // Poll task status
  useEffect(() => {
    if (taskId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/podcast-status/${taskId}`);
          if (response.ok) {
            const data = await response.json();
            setStatus(data.status);
            if (data.status === "completed" || data.status.startsWith("failed")) {
              clearInterval(interval);
              setLoading(false);
              fetchPodcasts();
            }
          }
        } catch (err) {
          clearInterval(interval);
          setLoading(false);
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
      const response = await fetch(`${API_BASE_URL}/generate-podcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          document_ids: selectedDocumentIds.map(Number),
          topic: topic || null,
          episodes: Number.isInteger(episodes) ? episodes : 1,
          language: language || "en",
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
    if (!window.confirm("Are you sure you want to delete this audio cast?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/podcasts/${podcastId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchPodcasts();
      }
    } catch (err) {
      console.error("Failed to delete podcast:", err);
    }
  };

  const playEpisode = (podcastId, episodeIndex) => {
    const audioKey = `${podcastId}-${episodeIndex}`;
    if (currentlyPlaying && audioRefs.current[currentlyPlaying]) {
      audioRefs.current[currentlyPlaying].pause();
    }
    const audioEl = audioRefs.current[audioKey];
    if (audioEl) {
      audioEl.play().then(() => {
        setCurrentlyPlaying(audioKey);
        setPlayingEpisode({ podcastId, episodeIndex });
      });
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

  const isPlaying = (podcastId, episodeIndex) => {
    return playingEpisode?.podcastId === podcastId && playingEpisode?.episodeIndex === episodeIndex;
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto flex flex-col gap-10 font-body">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-6">
        <div>
          <h1 className="font-headline text-4xl md:text-5xl font-black tracking-tight text-white mb-2 flex items-center gap-4">
            AI Audio Cast <span className="material-symbols-outlined text-primary text-5xl">headphones</span>
          </h1>
          <p className="text-white/70 font-body text-sm md:text-base max-w-2xl">
            Transform your long study documents into an engaging, multi-episode podcast. Perfect for learning on the go.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator Form */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-8 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none"></div>
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">mic</span>
              New Audio Cast
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Select Source Documents</label>
                <div className="relative">
                  <select
                    multiple
                    value={selectedDocumentIds.map(String)}
                    onChange={(e) => setSelectedDocumentIds(Array.from(e.target.selectedOptions, option => option.value))}
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none min-h-[120px] custom-scrollbar"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id} className="py-2 px-2 rounded-lg hover:bg-primary/20 cursor-pointer">📄 {doc.filename}</option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-white/40 italic">Hold Ctrl/Cmd to select multiple files.</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Custom Focus (Optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Focus only on the history of Rome..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Episodes</label>
                  <input
                    type="number"
                    value={episodes}
                    onChange={(e) => setEpisodes(e.target.value)}
                    min="1" max="5" required
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none text-center"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Voice Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary/50 outline-none"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || documents.length === 0}
                className="w-full py-4 bg-gradient-to-br from-primary to-primary-container text-[#001f27] font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(114,220,255,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="material-symbols-outlined animate-spin">sync</span> Mixing Audio...</>
                ) : (
                  <><span className="material-symbols-outlined fill">play_arrow</span> Generate Podcast</>
                )}
              </button>
              
              {status && status !== "completed" && (
                <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-xl flex items-center gap-3 text-primary text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  Status: {status}
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold text-center">
                  {error}
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Right Column: Library of Generated Podcasts */}
        <section className="lg:col-span-8 flex flex-col gap-6">
           <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
             <span className="material-symbols-outlined text-secondary">library_music</span>
             Your Audio Library
           </h2>

           {podcasts.length === 0 ? (
             <div className="glass-card p-12 rounded-3xl border border-white/5 border-dashed flex flex-col items-center justify-center text-center opacity-50">
               <span className="material-symbols-outlined text-6xl mb-4">podcasts</span>
               <h3 className="text-xl font-bold text-white mb-2">No Casts Yet</h3>
               <p className="text-white/60 max-w-sm">Select some documents and click generate to create your first AI-narrated study session.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-6">
                {podcasts.map((podcast) => (
                  <div key={podcast.id} className="glass-card rounded-3xl border border-white/10 bg-black/20 overflow-hidden shadow-lg transition-all hover:border-white/20">
                    {/* Podcast Header Area */}
                    <div className="p-6 border-b border-white/5 bg-gradient-to-r from-primary/10 to-transparent flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <span className="px-3 py-1 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full border border-primary/20">
                             Audio Cast
                           </span>
                           <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">ID: {podcast.id.split('-')[0]}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">Study Session based on Doc #{podcast.document_id}</h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {podcast.status === "completed" && (
                          <>
                            <div className="flex -space-x-2">
                              {podcast.episodes.map((_, i) => (
                                <div key={i} className="w-8 h-8 rounded-full bg-surface-container-high border-2 border-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg z-10 relative">
                                  Ep.{i+1}
                                </div>
                              ))}
                            </div>
                            <button onClick={() => savePodcast(podcast)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-all border border-white/10" title="Save Podcast">
                              <span className="material-symbols-outlined text-sm">bookmark</span>
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(podcast.id)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition-all border border-white/10" title="Delete Podcast">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Podcast Body / Player Area */}
                    <div className="p-6">
                      {podcast.status === "processing" ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-4 opacity-70">
                          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                          <p className="text-sm font-bold text-primary animate-pulse tracking-widest uppercase">Synthesizing Voice...</p>
                        </div>
                      ) : podcast.status.startsWith("failed") ? (
                        <div className="p-4 bg-red-500/10 text-red-400 rounded-xl text-sm border border-red-500/20 text-center">
                           ⚠️ Failed to generate audio. Please try again.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {podcast.episodes.map((ep, idx) => {
                            const audioKey = `${podcast.id}-${idx}`;
                            // Ensure the URL is correctly formatted for the frontend
                            const audioSrc = ep.startsWith("http") ? ep : `${API_BASE_URL}/static/${ep.split('/').pop()}`;
                            const isEpPlaying = isPlaying(podcast.id, idx);

                            return (
                              <div key={idx} className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-center gap-6 ${isEpPlaying ? 'bg-primary/5 border-primary/30 shadow-[0_0_20px_rgba(114,220,255,0.1)]' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                                
                                <button 
                                  onClick={() => isEpPlaying ? pauseEpisode(podcast.id, idx) : playEpisode(podcast.id, idx)}
                                  className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isEpPlaying ? 'bg-primary text-[#001f27] shadow-[0_0_15px_var(--primary)]' : 'bg-surface-container-high text-white hover:bg-primary/20 hover:text-primary border border-white/10'}`}
                                >
                                  <span className="material-symbols-outlined text-2xl fill">{isEpPlaying ? 'pause' : 'play_arrow'}</span>
                                </button>
                                
                                <div className="flex-1 w-full flex flex-col gap-2">
                                  <div className="flex justify-between items-center">
                                    <h4 className={`font-bold ${isEpPlaying ? 'text-primary' : 'text-white'}`}>Part {idx + 1}: Deep Dive</h4>
                                    {isEpPlaying && <div className="flex items-center gap-1 h-4">
                                      <div className="w-1 bg-primary animate-pulse h-full"></div>
                                      <div className="w-1 bg-primary animate-pulse h-2/3 delay-75"></div>
                                      <div className="w-1 bg-primary animate-pulse h-full delay-150"></div>
                                    </div>}
                                  </div>
                                  
                                  {/* Hidden native audio player used for logic */}
                                  <audio
                                    ref={(ref) => { if (ref) audioRefs.current[audioKey] = ref; }}
                                    src={audioSrc}
                                    onPlay={() => { setCurrentlyPlaying(audioKey); setPlayingEpisode({ podcastId: podcast.id, episodeIndex: idx }); }}
                                    onPause={() => { if (currentlyPlaying === audioKey) { setCurrentlyPlaying(null); setPlayingEpisode(null); } }}
                                    className="w-full h-8 filter opacity-50 grayscale hover:grayscale-0 transition-all"
                                    controls
                                    controlsList="nodownload noplaybackrate"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
             </div>
           )}
        </section>
      </div>
    </div>
  );
};

export default AudioSummaryPage;
