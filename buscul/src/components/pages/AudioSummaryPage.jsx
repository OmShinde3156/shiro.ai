import React, { useState, useEffect, useRef } from "react";
import "./audiosummarypage.css";
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

  const AUDIO_FILES_URL = `${API_BASE_URL}/static/podcasts`;

  // Function to fetch available documents for the user
  const fetchDocuments = async () => {
    if (!user || !user.id) return;
    console.log("Fetching documents for user:", user);
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${user.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      const data = await response.json();
      console.log("Fetched documents:", data);
      setDocuments(data);
    } catch (err) {
      console.error("Error fetching documents:", err);
      setError(err.message);
    }
  };

  // Function to fetch user podcasts
  const fetchPodcasts = async () => {
    if (!user || !user.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/podcasts/${user.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch podcasts");
      }
      const data = await response.json();
      setPodcasts(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Fetch documents and podcasts on component mount
  useEffect(() => {
    if (user && user.id) {
      fetchDocuments();
      fetchPodcasts();
    }
  }, [user]);

  // Function to poll task status
  useEffect(() => {
    if (taskId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/podcast-status/${taskId}`);
          if (!response.ok) {
            throw new Error("Failed to get task status");
          }
          const data = await response.json();
          setStatus(data.status);
          if (data.status === "completed" || data.status.startsWith("failed")) {
            clearInterval(interval);
            setLoading(false);
            fetchPodcasts();
          }
        } catch (err) {
          setError(err.message);
          clearInterval(interval);
          setLoading(false);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [taskId]);

  // Handle multiple select change
  const handleDocumentSelectChange = (e) => {
    const options = e.target.options;
    const value = [];
    for (let i = 0, l = options.length; i < l; i++) {
      if (options[i].selected) {
        value.push(parseInt(options[i].value, 10));
      }
    }
    setSelectedDocumentIds(value);
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to generate a podcast.");
      return;
    }
    if (selectedDocumentIds.length === 0) {
      setError("Please select at least one document.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    setTaskId(null);
    try {
      const payload = {
        user_id: user.id,
        document_ids: selectedDocumentIds,
        topic: topic || null,
        episodes: Number.isInteger(episodes) ? episodes : 1,
        language: language || "en",
      };
      console.log("Sending request:", payload);

      const response = await fetch(`${API_BASE_URL}/generate-podcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errMsg = await response.text();
        throw new Error(`Failed to start podcast generation: ${errMsg}`);
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setStatus("processing");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  

  // Enhanced audio control functions
  const playEpisode = (podcastId, episodeIndex, episodePath) => {
    const audioKey = `${podcastId}-${episodeIndex}`;

    // Stop any currently playing audio
    if (currentlyPlaying && audioRefs.current[currentlyPlaying]) {
      audioRefs.current[currentlyPlaying].pause();
      audioRefs.current[currentlyPlaying].currentTime = 0;
    }

    // Play the selected episode
    const audioEl = audioRefs.current[audioKey];
    if (audioEl) {
      audioEl
        .play()
        .then(() => {
          setCurrentlyPlaying(audioKey);
          setPlayingEpisode({ podcastId, episodeIndex });
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          setError("Failed to play audio. Please check if the file exists.");
        });
    } else {
      console.error("Audio element not found for key:", audioKey);
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
    return (
      playingEpisode?.podcastId === podcastId &&
      playingEpisode?.episodeIndex === episodeIndex
    );
  };

  return (
    <div className="audio-summary-page">
      <div className="header-section">
        <h1 className="page-title">Generate Audio Summary</h1>
        <p className="page-subtitle">
          Transform your documents into engaging podcasts
        </p>
      </div>

      <div className="form-section">
        <form onSubmit={handleSubmit} className="summary-form">
          <div className="form-group">
            <label>Select Document(s)</label>
            <select
              multiple
              value={selectedDocumentIds.map(String)}
              onChange={handleDocumentSelectChange}
              required
              className="document-select"
            >
              {documents.length === 0 && (
                <option value="" disabled>
                  No documents available
                </option>
              )}
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </select>
            <small className="form-hint">
              Hold Ctrl/Cmd to select multiple documents
            </small>
          </div>

          <div className="form-group">
            <label>Customize Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Explain the main concepts for a beginner"
              className="topic-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Episodes</label>
              <input
                type="number"
                value={episodes}
                onChange={(e) =>
                  setEpisodes(parseInt(e.target.value, 10) || 1)
                }
                min="1"
                max="10"
                required
              />
            </div>
            <div className="form-group">
              <label>Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="it">Italian</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading || documents.length === 0 || selectedDocumentIds.length === 0
            }
            className="generate-button"
          >
            {loading ? (
              <>
                <div className="spinner"></div> Generating...
              </>
            ) : (
              "Generate Podcast"
            )}
          </button>
        </form>

        {error && (
          <div className="error-message">
            <div className="error-icon">⚠️</div>
            <span>{error}</span>
          </div>
        )}

        {status && (
          <div className="status-message">
            <div className="status-icon">
              {status === "completed" ? "✅" : "⏳"}
            </div>
            <span>Status: {status}</span>
          </div>
        )}
      </div>

      <div className="podcasts-section">
        <h2 className="section-title">Your Podcasts</h2>
        {podcasts.length > 0 ? (
          <div className="podcasts-grid">
            {podcasts.map((podcast) => (
              <div key={podcast.id} className="podcast-card">
                <div className="podcast-header">
                  <div className="podcast-info">
                    <h3>Podcast #{podcast.id}</h3>
                    <div className="podcast-meta">
                      <span>📄 Doc ID: {podcast.document_id}</span>
                      <span>🎧 {podcast.episodes.length} Episodes</span>
                      <span className={`status-badge ${podcast.status}`}>
                        {podcast.status}
                      </span>
                    </div>
                  </div>
                </div>

                {podcast.status === "completed" && (
                  <div className="episodes-container">
                    <h4>Episodes</h4>
                    {podcast.episodes.map((ep, idx) => {
                      const audioKey = `${podcast.id}-${idx}`;
                      const audioSrc = ep.startsWith("http")
                        ? ep
                        : `${API_BASE_URL}/static/${ep}`;

                      return (
                        <div key={idx} className="episode-item">
                          <div className="episode-header">
                            <span className="episode-title">
                              Episode {idx + 1}
                            </span>
                            <div className="episode-controls">
                              <button
                                onClick={() => {
                                  if (isPlaying(podcast.id, idx)) {
                                    pauseEpisode(podcast.id, idx);
                                  } else {
                                    playEpisode(podcast.id, idx, ep);
                                  }
                                }}
                                className="play-button"
                              >
                                {isPlaying(podcast.id, idx) ? "⏸️" : "▶️"}
                              </button>
                            </div>
                          </div>

                          <audio
                            ref={(ref) => {
                              if (ref) audioRefs.current[audioKey] = ref;
                            }}
                            src={audioSrc}
                            controls
                            className="episode-audio"
                            onPlay={() => {
                              setCurrentlyPlaying(audioKey);
                              setPlayingEpisode({
                                podcastId: podcast.id,
                                episodeIndex: idx,
                              });
                            }}
                            onPause={() => {
                              if (currentlyPlaying === audioKey) {
                                setCurrentlyPlaying(null);
                                setPlayingEpisode(null);
                              }
                            }}
                            onError={() => {
                              setError(`Failed to load episode ${idx + 1}`);
                            }}
                          >
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => savePodcast(podcast)}
                      className="save-button"
                    >
                      💾 Save Podcast
                    </button>
                  </div>
                )}

                {podcast.status === "processing" && (
                  <div className="processing-message">
                    <div className="spinner"></div>
                    <span>Generating your podcast...</span>
                  </div>
                )}

                {podcast.status === "failed" && (
                  <div className="failed-message">
                    <span>❌ Failed to generate podcast</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="no-podcasts">
            <div className="no-podcasts-icon">🎙️</div>
            <h3>No podcasts yet</h3>
            <p>Generate your first podcast by selecting documents above</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioSummaryPage;


