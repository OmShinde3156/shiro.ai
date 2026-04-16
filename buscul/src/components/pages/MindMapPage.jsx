import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';
import './MindMapPage.css';

const MindMapPage = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mindMapData, setMindMapData] = useState(null);
  const [userMindMaps, setUserMindMaps] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDocuments();
    fetchUserMindMaps();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchUserMindMaps = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/mindmaps/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserMindMaps(data);
      }
    } catch (error) {
      console.error('Error fetching mind maps:', error);
    }
  };

  const generateMindMap = async () => {
    if (!selectedDocumentId) {
      setError('Please select a document');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/generate-mindmap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: parseInt(selectedDocumentId),
          topic: topic || null,
          depth: depth,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔍 MindMap data received:', data);
        console.log('🔍 Nodes with scores:', data.nodes?.map(n => ({
          label: n.label,
          score: n.score,
          scoreType: typeof n.score
        })));
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

  // Improved score validation and display
  const getValidScore = (score) => {
    console.log(`🔍 Processing score: ${score} (type: ${typeof score})`);
    
    // Handle different score formats
    let num;
    
    if (typeof score === 'string') {
      // Remove any non-numeric characters except decimal point
      const cleanScore = score.replace(/[^0-9.]/g, '');
      num = parseFloat(cleanScore);
    } else {
      num = parseFloat(score);
    }
    
    // Check for valid number
    if (isNaN(num) || !isFinite(num)) {
      console.warn(`❌ Invalid score detected: ${score}, using fallback`);
      return 30; // Lower fallback to distinguish from calculated scores
    }
    
    // Ensure score is in reasonable range
    if (num < 0) num = 0;
    if (num > 1) {
      // If score is already a percentage (>1), normalize it
      if (num <= 100) {
        num = num / 100;
      } else {
        num = 1;
      }
    }
    
    // Convert to percentage and round
    const percentage = Math.round(num * 100);
    console.log(`✅ Final percentage: ${percentage}%`);
    
    return Math.max(5, Math.min(100, percentage)); // Ensure range 5-100%
  };

  // Get visual styling based on score
  const getScoreStyle = (score) => {
    const percentage = getValidScore(score);
    
    if (percentage >= 80) return 'score-high';
    if (percentage >= 60) return 'score-medium';
    if (percentage >= 40) return 'score-low';
    return 'score-very-low';
  };

  /** Recursive Node Renderer with better score display **/
  const renderMindMapNode = (node, edges, level = 0) => {
    const childEdges = edges.filter(edge => edge.source === node.id);
    const childNodes = childEdges.map(edge =>
      mindMapData.nodes.find(n => n.id === edge.target)
    ).filter(Boolean);

    const scorePercentage = getValidScore(node.score);
    const scoreClass = getScoreStyle(node.score);

    return (
      <div key={node.id} className={`mind-map-node level-${level}`}>
        <div className={`node-content ${level === 0 ? 'root-node' : ''}`}>
          <div className="node-label">{node.label}</div>
          <span className={`node-score ${scoreClass}`}>
            {scorePercentage}%
          </span>
          {/* Debug info - remove in production */}
          <span className="debug-score" style={{fontSize: '10px', opacity: 0.5}}>
            (raw: {typeof node.score === 'number' ? node.score.toFixed(3) : node.score})
          </span>
        </div>

        {childNodes.length > 0 && (
          <div className="child-nodes">
            {childNodes.map(childNode =>
              renderMindMapNode(childNode, edges, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMindMap = () => {
    if (!mindMapData || !mindMapData.nodes) {
      console.warn('No mindmap data available');
      return <div className="no-data">No mind map data available</div>;
    }

    const rootNode = mindMapData.nodes.find(node => node.level === 0);
    if (!rootNode) {
      console.warn('No root node found');
      return <div className="no-data">No root node found</div>;
    }

    console.log('Rendering mindmap with nodes:', mindMapData.nodes.length);
    console.log('Node scores:', mindMapData.nodes.map(n => ({label: n.label, score: n.score})));

    return (
      <div className="mind-map-visualization">
        <div className="score-legend">
          <span className="legend-item">
            <span className="legend-color score-high"></span> High (80%+)
          </span>
          <span className="legend-item">
            <span className="legend-color score-medium"></span> Medium (60-79%)
          </span>
          <span className="legend-item">
            <span className="legend-color score-low"></span> Low (40-59%)
          </span>
          <span className="legend-item">
            <span className="legend-color score-very-low"></span> Very Low (&lt;40%)
          </span>
        </div>
        {renderMindMapNode(rootNode, mindMapData.edges)}
      </div>
    );
  };

  return (
    <div className="mindmap-page">
      <div className="mindmap-header">
        <h2>Mind Map Generator</h2>
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create New
          </button>
          <button
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            My Mind Maps ({userMindMaps.length})
          </button>
          {mindMapData && (
            <button
              className={`tab-button ${activeTab === 'view' ? 'active' : ''}`}
              onClick={() => setActiveTab('view')}
            >
              Current Map
            </button>
          )}
        </div>
      </div>

      {activeTab === 'create' && (
        <div className="mindmap-form">
          <div className="form-group">
            <label htmlFor="document">Select Document:</label>
            <select
              id="document"
              value={selectedDocumentId}
              onChange={(e) => setSelectedDocumentId(e.target.value)}
              className="form-select"
            >
              <option value="">Choose a document...</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.filename}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="topic">Topic (Optional):</label>
            <input
              type="text"
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Leave empty for auto-generated topic"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="depth">Depth Level:</label>
            <select
              id="depth"
              value={depth}
              onChange={(e) => setDepth(parseInt(e.target.value))}
              className="form-select"
            >
              <option value={1}>Level 1 (Basic)</option>
              <option value={2}>Level 2 (Detailed)</option>
              <option value={3}>Level 3 (Comprehensive)</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            onClick={generateMindMap}
            disabled={isGenerating || !selectedDocumentId}
            className="generate-button"
          >
            {isGenerating ? (
              <>
                <div className="spinner"></div>
                Generating Mind Map...
              </>
            ) : (
              'Generate Mind Map'
            )}
          </button>
        </div>
      )}

      {activeTab === 'view' && mindMapData && (
        <div className="mindmap-display">
          <div className="mindmap-info">
            <h3>{mindMapData.topic}</h3>
            <p>Nodes: {mindMapData.nodes?.length || 0} | Edges: {mindMapData.edges?.length || 0}</p>
            <p>Created: {new Date(mindMapData.created_at).toLocaleDateString()}</p>
          </div>
          {renderMindMap()}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="mindmap-history">
          {userMindMaps.length === 0 ? (
            <div className="no-mindmaps">
              <p>No mind maps created yet.</p>
              <button
                onClick={() => setActiveTab('create')}
                className="create-first-button"
              >
                Create Your First Mind Map
              </button>
            </div>
          ) : (
            <div className="mindmap-list">
              {userMindMaps.map((mindmap) => (
                <div key={mindmap.mindmap_id} className="mindmap-item">
                  <h4>{mindmap.topic}</h4>
                  <p>Document ID: {mindmap.document_id}</p>
                  <p>Nodes: {mindmap.node_count}</p>
                  <p>Created: {new Date(mindmap.created_at).toLocaleDateString()}</p>
                  <button
                    className="view-button"
                    onClick={async () => {
                      try {
                        const response = await fetch(`${API_BASE_URL}/mindmaps/${mindmap.mindmap_id}`);
                        if (response.ok) {
                          const data = await response.json();
                          setMindMapData(data);
                          setActiveTab('view');
                        }
                      } catch (error) {
                        console.error('Error fetching mindmap:', error);
                      }
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MindMapPage;

