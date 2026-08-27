import React, { useMemo, useState, useCallback, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position, 
  useNodesState, 
  useEdgesState,
  Panel
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';
import { 
  Sparkles, 
  BrainCircuit, 
  HelpCircle, 
  Layers, 
  Download, 
  Search, 
  Maximize2, 
  X, 
  CheckCircle2, 
  BookOpen, 
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Compass
} from 'lucide-react';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';

// 🌿 REFINED EDITORIAL NODE COMPONENT
const EditorialNode = ({ data, selected }) => {
  const isRoot = data.level === 0;
  const isBranch = data.level === 1;

  // Level-specific refined styling
  const getNodeClasses = () => {
    if (isRoot) {
      return 'bg-[#89A88D]/20 border-2 border-[#89A88D] text-[var(--text-main)] shadow-md shadow-[#89A88D]/10';
    }
    if (isBranch) {
      return 'bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-main)] hover:border-[#89A88D]/50 shadow-sm';
    }
    return 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/30';
  };

  return (
    <div
      className={`relative px-4 py-3 rounded-2xl transition-all duration-200 cursor-pointer min-w-[140px] max-w-[260px] text-center select-none ${getNodeClasses()} ${
        selected ? 'ring-2 ring-[#89A88D] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-105' : ''
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-[#89A88D] !w-2 !h-2 !border-0" 
      />
      
      {/* Node Content */}
      <div className="flex flex-col items-center gap-1">
        {isRoot && (
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#89A88D] font-bold">
            Core Concept
          </span>
        )}
        <div className={`font-semibold leading-snug ${isRoot ? 'text-sm md:text-base font-serif font-bold' : 'text-xs'}`}>
          {data.label}
        </div>
        
        {data.score !== undefined && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D6A84F]/15 border border-[#D6A84F]/30 text-[10px] text-[#D6A84F] font-mono font-medium">
              💡 {Math.round(data.score * 100)}% Mastered
            </span>
          </div>
        )}
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-[#89A88D] !w-2 !h-2 !border-0" 
      />
    </div>
  );
};

// 📐 Dagre Layout Optimizer
const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ 
    rankdir: 'TB', 
    nodesep: 140, 
    ranksep: 180, 
    marginx: 60,
    marginy: 60
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 220, height: 90 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 45,
      },
    };
  });
};

export const ProMindMap = ({ data, onStudyAction }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const flowRef = useRef(null);

  const nodeTypes = useMemo(() => ({ editorial: EditorialNode }), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    const rawNodes = data.nodes.map((node) => ({
      id: String(node.id),
      type: 'editorial',
      data: { 
        label: node.label, 
        level: node.level || 0, 
        score: node.score,
        details: node.description || node.details || `Key concept node focusing on ${node.label}.`
      },
      width: 220,
      height: 90
    }));

    const rawEdges = (data.edges || []).map((edge) => ({
      id: `e-${edge.source}-${edge.target}`,
      source: String(edge.source),
      target: String(edge.target),
      animated: true,
      style: { stroke: 'rgba(137, 168, 141, 0.45)', strokeWidth: 2 },
      type: 'bezier'
    }));

    return { 
      initialNodes: getLayoutedElements(rawNodes, rawEdges), 
      initialEdges: rawEdges 
    };
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Filter & Highlight Nodes when Searching
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    return nodes.map((node) => {
      const isMatch = node.data.label.toLowerCase().includes(searchQuery.toLowerCase());
      return {
        ...node,
        selected: isMatch
      };
    });
  }, [nodes, searchQuery]);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="relative w-full h-full bg-[var(--bg-canvas)] overflow-hidden flex">
      {/* 1. Main Interactive Flow Canvas */}
      <div className="flex-1 h-full w-full relative">
        <ReactFlow
          ref={flowRef}
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false}
          nodesDraggable={true}
          elementsSelectable={true}
        >
          <Background color="var(--border)" gap={28} size={1} variant="dots" />
          <Controls showInteractive={false} className="!bg-[var(--bg-surface)] !border-[var(--border)] !rounded-xl !shadow-md" />

          {/* Floating Search & Legend Panel */}
          <Panel position="top-left" className="m-4">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border)] shadow-md">
              <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                <Search className="w-3.5 h-3.5 text-[#89A88D]" />
                <input
                  type="text"
                  placeholder="Find concept in map..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs text-[var(--text-main)] w-36 sm:w-48 placeholder-[var(--text-muted)]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </Panel>

          {/* Legend Panel */}
          <Panel position="bottom-left" className="m-4">
            <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border)] text-[11px] text-[var(--text-secondary)] shadow-sm">
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#89A88D]" />
                <span>Core Pillar</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)]" />
                <span>Branch Subtopic</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D6A84F]" />
                <span>Mastered Topic</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* 2. Interactive Node Insight Drawer */}
      {selectedNode && (
        <div className="w-80 md:w-96 h-full bg-[var(--bg-surface)] border-l border-[var(--border)] p-5 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto custom-scroll">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#89A88D] block font-bold">
                  {selectedNode.data.level === 0 ? 'Primary Concept' : `Depth Level ${selectedNode.data.level}`}
                </span>
                <h3 className="text-base md:text-lg font-bold text-[var(--text-main)] font-serif mt-0.5">
                  {selectedNode.data.label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Concept Explanation Card */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] leading-relaxed space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)]">
                <BookOpen className="w-3.5 h-3.5 text-[#89A88D]" />
                <span>Concept Synopsis</span>
              </div>
              <p>{selectedNode.data.details}</p>
            </div>

            {/* Mastery Score Gauge */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Retention Mastery</span>
                <span className="font-semibold text-[#D6A84F]">
                  {selectedNode.data.score ? `${Math.round(selectedNode.data.score * 100)}%` : '80% Baseline'}
                </span>
              </div>
              <div className="w-full bg-[var(--bg-surface)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                <div 
                  className="bg-[#D6A84F] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${selectedNode.data.score ? Math.round(selectedNode.data.score * 100) : 80}%` }}
                />
              </div>
            </div>

            {/* Connected Study Workflows */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                Study Actions for "{selectedNode.data.label}"
              </span>
              
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-between"
                onClick={() => onStudyAction && onStudyAction('quiz', selectedNode.data.label)}
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Generate Topic Quiz</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-between"
                onClick={() => onStudyAction && onStudyAction('flashcards', selectedNode.data.label)}
              >
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#62816A]" />
                  <span>Create Flashcards</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between border border-[var(--border)]"
                onClick={() => onStudyAction && onStudyAction('feynman', selectedNode.data.label)}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#D6A84F]" />
                  <span>Feynman Challenge</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] text-center">
            Click outside or on another node to switch context
          </div>
        </div>
      )}
    </div>
  );
};

export default ProMindMap;
