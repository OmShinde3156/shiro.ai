import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../api/config.js';
import ProMindMap from './ProMindMap';
import './MindMapPage.css';

const MindMapPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mindMapData, setMindMapData] = useState(null);
  const [userMindMaps, setUserMindMaps] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    if (!user?.id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchUserMindMaps = async () => {
    if (!user?.id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/mindmaps`);
      if (response.ok) {
        const data = await response.json();
        setUserMindMaps(data);
      }
    } catch (error) {
      console.error('Error fetching mind maps:', error);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDocuments();
      fetchUserMindMaps();
    }
  }, [user]);

  const generateMindMap = async () => {
    if (!selectedDocumentId) {
      setError('Please select a document');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/generate-mindmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: parseInt(selectedDocumentId),
          topic: topic || null,
          depth: depth,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMindMapData(data);
        setActiveTab('view');
        fetchUserMindMaps();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to generate mind map');
      }
    } catch (error) {
      setError('Error generating mind map: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mindmap-page-container">
      {/* Header with Navigation */}
      <header className="mindmap-global-header">
        <div className="header-left">

          <div className="title-group">
            <h1>Mind Maps</h1>
            <p>Knowledge Visualization Engine</p>
          </div>
        </div>

        <div className="header-tabs">
          {[
            { id: 'create', label: 'Create', icon: 'add_circle' },
            { id: 'history', label: 'Library', icon: 'history' },
            ...(mindMapData ? [{ id: 'view', label: 'Active Map', icon: 'hub' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mindmap-content-viewport">
        {activeTab === 'create' && (
          <div className="creation-flow">
            <div className="form-card">
              <h3>Initiate Mapping</h3>
              <div className="input-group">
                <label>Select Focus Material</label>
                <select value={selectedDocumentId} onChange={(e) => setSelectedDocumentId(e.target.value)}>
                  <option value="">Choose document...</option>
                  {documents.map(doc => <option key={doc.id} value={doc.id}>{doc.filename}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Specific Topic (Optional)</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Core principles" />
              </div>
              <div className="input-group">
                <label>Detail Level</label>
                <div className="depth-selector">
                  {[1, 2, 3].map(d => (
                    <button key={d} onClick={() => setDepth(d)} className={depth === d ? 'active' : ''}>
                      {d === 1 ? 'Core' : d === 2 ? 'Deep' : 'Expert'}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="error-text">{error}</p>}
              <button onClick={generateMindMap} disabled={isGenerating} className="primary-action-btn">
                {isGenerating ? 'Synthesizing...' : 'Generate Neural Map'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-grid">
            {userMindMaps.length === 0 ? (
              <div className="empty-state">No neural maps found in your library.</div>
            ) : (
              userMindMaps.map(m => (
                <div key={m.mindmap_id} className="map-history-card">
                  <div className="card-icon"><span className="material-symbols-outlined">hub</span></div>
                  <div className="card-info">
                    <h4>{m.topic}</h4>
                    <p>{m.node_count} concepts mapped</p>
                  </div>
                  <button onClick={async () => {
                    const res = await fetchWithAuth(`${API_BASE_URL}/mindmap-details/${m.mindmap_id}`);
                    if (res.ok) { setMindMapData(await res.json()); setActiveTab('view'); }
                  }} className="view-link">Open Map</button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'view' && mindMapData && (
          <div className="full-view-container">
            <ProMindMap data={mindMapData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapPage;
