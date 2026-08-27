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
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
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

  // Poll task status
  useEffect(() => {
    if (taskId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetchWithAuth(`${API_BASE_URL}/podcast-status/${taskId}`);
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
      const response = await fetchWithAuth(`${API_BASE_URL}/generate-podcast`, {
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
      const response = await fetchWithAuth(`${API_BASE_URL}/podcasts/${podcastId}`, {
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
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-[var(--text-main)] mb-2 flex items-center gap-4">
            AI Audio Cast <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D] text-4xl">headphones</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-sm md:text-base max-w-2xl">
            Transform your study documents into engaging, multi-episode audio casts. Perfect for learning on the go.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Generator Form */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-8 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] relative overflow-hidden shadow-sm">
            <h2 className="text-lg font-bold text-[var(--text-main)] mb-6 flex items-center gap-2 font-serif">
              <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">mic</span>
              New Audio Cast
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Select Source Documents</label>
                <div className="relative">
                  <select
                    multiple
                    value={selectedDocumentIds.map(String)}
                    onChange={(e) => setSelectedDocumentIds(Array.from(e.target.selectedOptions, option => option.value))}
                    required
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:border-[#3F6048] outline-none min-h-[120px] custom-scrollbar"
                  >
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id} className="py-2 px-2 rounded-lg cursor-pointer bg-[var(--bg-surface)] text-[var(--text-main)]">📄 {doc.filename}</option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] italic">Hold Ctrl/Cmd to select multiple files.</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Custom Focus (Optional)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Focus only on the history of Rome..."
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Episodes</label>
                  <input
                    type="number"
                    value={episodes}
                    onChange={(e) => setEpisodes(e.target.value)}
                    min="1" max="5" required
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:border-[#3F6048] outline-none text-center"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">Voice Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3 text-sm text-[var(--text-main)] focus:border-[#3F6048] outline-none"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || documents.length === 0}
                className="w-full py-3.5 bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white font-bold rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><span className="material-symbols-outlined animate-spin">sync</span> Synthesizing Audio...</>
                ) : (
                  <><span className="material-symbols-outlined fill">play_arrow</span> Generate Podcast</>
                )}
              </button>
              
              {status && status !== "completed" && (
                <div className="mt-4 p-3 bg-[#E8EFE9] dark:bg-[#89A88D]/15 border border-[#3F6048]/30 rounded-xl flex items-center gap-3 text-[#3F6048] dark:text-[#A8C5AC] text-xs font-bold uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse"></span>
                  Status: {status}
                </div>
              )}
              {error && (
                <div className="mt-4 p-3 bg-[#C96B62]/10 border border-[#C96B62]/30 rounded-xl text-[#C96B62] text-xs font-bold text-center">
                  {error}
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Right Column: Library of Generated Podcasts */}
        <section className="lg:col-span-8 flex flex-col gap-6">
           <h2 className="text-xl font-bold text-[var(--text-main)] tracking-tight flex items-center gap-3 font-serif">
             <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">library_music</span>
             Your Audio Library
           </h2>

           {podcasts.length === 0 ? (
             <div className="glass-card p-12 rounded-3xl border border-[var(--border)] border-dashed bg-[var(--bg-surface)] flex flex-col items-center justify-center text-center">
               <span className="material-symbols-outlined text-5xl mb-4 text-[var(--text-muted)] opacity-60">podcasts</span>
               <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 font-serif">No Casts Yet</h3>
               <p className="text-[var(--text-secondary)] text-xs max-w-sm">Select some documents and click generate to create your first AI-narrated study session.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-6">
                {podcasts.map((podcast) => (
                  <div key={podcast.id} className="glass-card rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden shadow-sm transition-all hover:border-[#3F6048]/40">
                    {/* Podcast Header Area */}
                    <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                           <span className="px-3 py-1 bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] text-[10px] font-bold uppercase tracking-widest rounded-full border border-[#3F6048]/30">
                             Audio Cast
                           </span>
                           <span className="text-[10px] text-[var(--text-muted)] font-mono">ID: {podcast.id.split('-')[0]}</span>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">Study Session based on Doc #{podcast.document_id}</h3>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {podcast.status === "completed" && (
                          <>
                            <div className="flex -space-x-2">
                              {podcast.episodes.map((_, i) => (
                                <div key={i} className="w-8 h-8 rounded-full bg-[var(--bg-surface)] border-2 border-[#3F6048] dark:border-[#89A88D] flex items-center justify-center text-[10px] font-bold text-[var(--text-main)] shadow-sm z-10 relative">
                                  Ep.{i+1}
                                </div>
                              ))}
                            </div>
                            <button onClick={() => savePodcast(podcast)} className="w-9 h-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[#E8EFE9] text-[var(--text-secondary)] hover:text-[#3F6048] transition-all border border-[var(--border)]" title="Save Podcast">
                              <span className="material-symbols-outlined text-sm">bookmark</span>
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(podcast.id)} className="w-9 h-9 rounded-full bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[#C96B62]/15 text-[var(--text-muted)] hover:text-[#C96B62] transition-all border border-[var(--border)]" title="Delete Podcast">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Podcast Body / Player Area */}
                    <div className="p-6">
                      {podcast.status === "processing" ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-4 opacity-80">
                          <div className="w-10 h-10 border-3 border-[#3F6048]/30 border-t-[#3F6048] rounded-full animate-spin"></div>
                          <p className="text-xs font-bold text-[#3F6048] dark:text-[#89A88D] animate-pulse tracking-widest uppercase font-mono">Synthesizing Voice...</p>
                        </div>
                      ) : podcast.status.startsWith("failed") ? (
                        <div className="p-4 bg-[#C96B62]/10 text-[#C96B62] rounded-xl text-xs border border-[#C96B62]/30 text-center">
                           ⚠️ Failed to generate audio. Please try again.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {podcast.episodes.map((ep, idx) => {
                            const audioKey = `${podcast.id}-${idx}`;
                            const audioSrc = ep.startsWith("http") ? ep : `${API_BASE_URL}/static/${ep.split('/').pop()}`;
                            const isEpPlaying = isPlaying(podcast.id, idx);

                            return (
                              <div key={idx} className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-center gap-4 ${isEpPlaying ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/15 border-[#3F6048]/40 shadow-xs' : 'bg-[var(--bg-surface-elevated)] border-[var(--border)]'}`}>
                                
                                <button 
                                  onClick={() => isEpPlaying ? pauseEpisode(podcast.id, idx) : playEpisode(podcast.id, idx)}
                                  className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isEpPlaying ? 'bg-[#3F6048] text-white shadow-sm' : 'bg-[var(--bg-surface)] text-[var(--text-main)] hover:bg-[#E8EFE9] border border-[var(--border)]'}`}
                                >
                                  <span className="material-symbols-outlined text-2xl fill">{isEpPlaying ? 'pause' : 'play_arrow'}</span>
                                </button>
                                
                                <div className="flex-1 w-full flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <h4 className={`text-sm font-bold ${isEpPlaying ? 'text-[#3F6048] dark:text-[#A8C5AC]' : 'text-[var(--text-main)]'}`}>Part {idx + 1}: Deep Dive</h4>
                                  </div>
                                  
                                  <audio
                                    ref={(ref) => { if (ref) audioRefs.current[audioKey] = ref; }}
                                    src={audioSrc}
                                    onPlay={() => { setCurrentlyPlaying(audioKey); setPlayingEpisode({ podcastId: podcast.id, episodeIndex: idx }); }}
                                    onPause={() => { if (currentlyPlaying === audioKey) { setCurrentlyPlaying(null); setPlayingEpisode(null); } }}
                                    className="w-full h-8 filter opacity-70 hover:opacity-100 transition-opacity"
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
