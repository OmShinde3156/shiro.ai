import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Context } from '../../../context/Context';
import API_BASE_URL from '../../../api/config.js';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import ProMindMap from './ProMindMap';
import { 
  Network, 
  Sparkles, 
  Layers, 
  BookOpen, 
  Plus, 
  Clock, 
  Search, 
  ArrowRight, 
  HelpCircle, 
  CheckCircle2, 
  Trash2,
  ChevronRight,
  Zap
} from 'lucide-react';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Tooltip from '../../../components/ui/Tooltip';

export const MindMapPage = () => {
  const { user } = useAuth();
  const { t } = useContext(Context);
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mindMapData, setMindMapData] = useState(null);
  const [userMindMaps, setUserMindMaps] = useState([]);
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history' | 'view'
  const [error, setError] = useState('');

  const fetchDocuments = async () => {
    if (!user?.id) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
        if (data.length > 0 && !selectedDocumentId) {
          setSelectedDocumentId(String(data[0].id));
        }
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
      setError('Please select a focus document');
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
          topic: topic.trim() || null,
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

  const handleOpenMindMap = async (mapId) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/mindmap-details/${mapId}`);
      if (res.ok) {
        const data = await res.json();
        setMindMapData(data);
        setActiveTab('view');
      }
    } catch (err) {
      console.error('Failed to load mind map', err);
    }
  };

  const handleStudyAction = (tool, conceptName) => {
    if (tool === 'quiz') {
      navigate('/quiz');
    } else if (tool === 'flashcards') {
      navigate('/flashcards');
    } else if (tool === 'feynman') {
      navigate('/feynman');
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* 1. Header Toolbar */}
      <div className="w-full px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#89A88D] mb-0.5">
            <Network className="w-3.5 h-3.5" />
            <span>KNOWLEDGE VISUALIZATION ENGINE</span>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-main)] font-serif">
            Mind Maps
          </h1>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'create'
                ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
          
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Library ({userMindMaps.length})</span>
          </button>

          {mindMapData && (
            <button
              onClick={() => setActiveTab('view')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'view'
                  ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Active Canvas</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="flex-1 w-full overflow-y-auto custom-scroll touch-scroll">
        {/* VIEW A: CREATE NEW MIND MAP */}
        {activeTab === 'create' && (
          <div className="max-w-3xl mx-auto px-3.5 sm:px-6 py-6 sm:py-8 space-y-6">
            <Card className="border-[var(--border)]">
              <CardHeader
                title="Synthesize Knowledge Map"
                subtitle="Transform notes into an interactive, multi-level concept hierarchy"
                icon={Sparkles}
              />
              <CardContent className="space-y-5 pt-2">
                {/* Document Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-main)]">
                    Select Focus Document
                  </label>
                  <select
                    value={selectedDocumentId}
                    onChange={(e) => setSelectedDocumentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                  >
                    <option value="">Select a document...</option>
                    {documents.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.filename} ({doc.subject || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Specific Topic (Optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-main)]">
                    Specific Concept or Focus Area (Optional)
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Neural network backprop, Contract Law remedies, Organic synthesis..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[#89A88D]"
                  />
                </div>

                {/* Depth Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-main)]">
                    Structural Depth Level
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { level: 1, label: 'Core Pillars', desc: 'High-level overview (1-2 branches)' },
                      { level: 2, label: 'Deep Breakdown', desc: 'Standard syllabus breakdown' },
                      { level: 3, label: 'Mastery Hierarchy', desc: 'Exhaustive sub-concepts & formulas' },
                    ].map((item) => (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => setDepth(item.level)}
                        className={`p-3 rounded-xl border text-left transition-all active:scale-98 ${
                          depth === item.level
                            ? 'bg-[#89A88D]/15 border-[#89A88D] text-[var(--text-main)] shadow-sm'
                            : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]'
                        }`}
                      >
                        <div className="font-semibold text-xs text-[var(--text-main)]">{item.label}</div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-[#C96B62]/10 border border-[#C96B62]/30 text-xs text-[#C96B62]">
                    {error}
                  </div>
                )}

                {/* Generate Button */}
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={isGenerating || !selectedDocumentId}
                  onClick={generateMindMap}
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing Concept Hierarchy...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Knowledge Map</span>
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Inspiration Pills */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Quick Presets
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { title: "Core Formulas & Principles", desc: "Maps all mathematical and theoretical foundations" },
                  { title: "Exam Cheat Sheet Hierarchy", desc: "Structures high-yield testable definitions" },
                ].map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => setTopic(preset.title)}
                    className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[#89A88D]/40 cursor-pointer transition-all text-xs"
                  >
                    <div className="font-semibold text-[var(--text-main)]">{preset.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{preset.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: SAVED MIND MAPS LIBRARY */}
        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-main)] font-serif">
                  Saved Knowledge Maps
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Explore previously synthesized mind maps and review concept graphs.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('create')}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Map</span>
              </Button>
            </div>

            {userMindMaps.length === 0 ? (
              <div className="text-center py-16 p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center justify-center text-[#89A88D] mx-auto">
                  <Network className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-main)]">No Knowledge Maps Created Yet</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                  Select any uploaded notes to generate an interactive concept hierarchy.
                </p>
                <Button variant="primary" size="sm" onClick={() => setActiveTab('create')}>
                  Create First Mind Map
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {userMindMaps.map((m) => (
                  <Card
                    key={m.mindmap_id}
                    onClick={() => handleOpenMindMap(m.mindmap_id)}
                    className="p-4 flex flex-col justify-between h-40 hover:scale-[1.01] cursor-pointer border-[var(--border)] hover:border-[#89A88D]/40 bg-[var(--bg-surface)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="p-2 rounded-xl bg-[#89A88D]/15 border border-[#89A88D]/30 text-[#89A88D]">
                        <Network className="w-4 h-4" />
                      </div>
                      <Badge variant="sage" size="sm">
                        {m.node_count || 12} Concepts
                      </Badge>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-[var(--text-main)] truncate font-serif">
                        {m.topic || "Document Overview"}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] truncate">
                        {m.document_filename || "Focus Material"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#89A88D] font-medium pt-2 border-t border-[var(--border)]">
                      <span>Open Canvas</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW C: FULL-SCREEN ACTIVE CANVAS */}
        {activeTab === 'view' && mindMapData && (
          <div className="w-full h-full">
            <ProMindMap data={mindMapData} onStudyAction={handleStudyAction} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMapPage;
