import React, { useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position,
  BaseEdge,
  getBezierPath
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

// Custom Node for a "Student" look (Organic Bubbles)
const CustomNode = ({ data }) => {
  const isRoot = data.level === 0;
  
  const colors = [
    'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)', // Root - Warm
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Level 1 - Blue
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Level 2 - Purple
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Level 3 - Green
  ];

  const color = colors[data.level % colors.length];

  return (
    <div style={{
      padding: isRoot ? '24px 36px' : '14px 20px',
      borderRadius: isRoot ? '50px' : '30px',
      background: color,
      color: 'white',
      border: '3px solid rgba(255,255,255,0.4)',
      boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
      textAlign: 'center',
      minWidth: isRoot ? '220px' : '140px',
      fontWeight: '800',
      fontSize: isRoot ? '20px' : '15px',
      position: 'relative',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      fontFamily: '"Inter", sans-serif'
    }}>
      <Handle type="target" position={Position.Top} style={{ background: '#72dcff', width: '8px', height: '8px' }} />
      <div style={{ marginBottom: data.score !== undefined ? '8px' : '0' }}>{data.label}</div>
      {data.score !== undefined && (
        <div style={{ 
          fontSize: '10px', 
          background: 'rgba(255,255,255,0.2)', 
          padding: '4px 10px', 
          borderRadius: '15px', 
          display: 'inline-block',
          border: '1px solid rgba(255,255,255,0.3)'
        }}>
          💡 {Math.round(data.score * 100)}% Mastered
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: '#72dcff', width: '8px', height: '8px' }} />
    </div>
  );
};

// Automatic Layout Engine
const getLayoutedElements = (nodes, edges) => {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ 
    rankdir: 'TB', 
    nodesep: 200, // Increased spacing between nodes in a row
    ranksep: 250, // Increased vertical spacing between levels
    marginx: 100,
    marginy: 100
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    // Account for node dimensions in layout
    g.setNode(node.id, { width: 300, height: 150 });
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
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - 75,
      },
    };
  });
};

const ProMindMap = ({ data }) => {
  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  const { layoutedNodes, layoutedEdges } = useMemo(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return { layoutedNodes: [], layoutedEdges: [] };

    const initialNodes = data.nodes.map((node) => ({
      id: String(node.id),
      type: 'custom',
      data: { 
        label: node.label, 
        level: node.level || 0, 
        score: node.score 
      },
      // Important for layout consistency
      width: 250,
      height: 100
    }));

    const initialEdges = data.edges.map(edge => ({
      id: `e-${edge.source}-${edge.target}`,
      source: String(edge.source),
      target: String(edge.target),
      animated: true,
      style: { stroke: '#72dcff', strokeWidth: 4, opacity: 0.8 },
      type: 'bezier' // Smoother organic curves
    }));

    return { 
        layoutedNodes: getLayoutedElements(initialNodes, initialEdges), 
        layoutedEdges: initialEdges 
    };
  }, [data]);

  return (
    <div style={{ 
      height: '100%', 
      width: '100%', 
      background: '#0b0e14', 
      position: 'relative'
    }}>
      <ReactFlow
        nodes={layoutedNodes}
        edges={layoutedEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        nodesConnectable={false}
        nodesDraggable={true}
        elementsSelectable={true}
      >
        <Background color="#151926" gap={30} variant="dots" />
        <Controls />
      </ReactFlow>
      
      {/* Legend - Moved to a more compact location */}
      <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 5, background: 'rgba(0,0,0,0.7)', padding: '10px 15px', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '8px', fontWeight: 'bold' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)' }}></div>
                  CORE
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '8px', fontWeight: 'bold' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}></div>
                  BRANCH
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '8px', fontWeight: 'bold' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}></div>
                  SUB
              </div>
          </div>
      </div>
    </div>
  );
};

export default ProMindMap;
