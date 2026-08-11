import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Context } from '../../context/Context';
import { 
  Search, 
  FileText, 
  Brain, 
  Zap, 
  BookOpen, 
  Layout, 
  Settings, 
  History, 
  GraduationCap,
  Command,
  ArrowRight
} from 'lucide-react';
import './CommandPalette.css';

const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { documents, fetchDocuments } = useContext(Context);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const navigationItems = [
    { id: 'home', title: 'Dashboard', icon: <Layout size={18} />, path: '/home', category: 'Pages' },
    { id: 'documents', title: 'Library', icon: <FileText size={18} />, path: '/documents', category: 'Pages' },
    { id: 'study-room', title: 'Deep Work Flow', icon: <Zap size={18} />, path: '/study-room', category: 'Pages' },
    { id: 'flashcards', title: 'Flashcards', icon: <BookOpen size={18} />, path: '/flashcards', category: 'Pages' },
    { id: 'quiz', title: 'Quiz Arena', icon: <GraduationCap size={18} />, path: '/quiz', category: 'Pages' },
    { id: 'mindmap', title: 'Mind Map', icon: <Brain size={18} />, path: '/mindmap', category: 'Pages' },
    { id: 'answer-planner', title: 'Answer Blueprint', icon: <BookOpen size={18} />, path: '/answer-planner', category: 'Pages' },
    { id: 'stats', title: 'Learning Analytics', icon: <History size={18} />, path: '/progress-report', category: 'Pages' },
    { id: 'settings', title: 'Settings', icon: <Settings size={18} />, path: '/settings', category: 'Pages' },
  ];

  const filteredDocs = documents
    .filter(doc => doc.filename.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5)
    .map(doc => ({
      id: `doc-${doc.id}`,
      title: doc.filename,
      icon: <FileText size={18} />,
      path: `/documents/${doc.id}`,
      category: 'Documents'
    }));

  const filteredNav = navigationItems.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const allResults = [...filteredNav, ...filteredDocs];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setSearch('');
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleAction = (item) => {
    navigate(item.path);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % allResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allResults.length) % allResults.length);
    } else if (e.key === 'Enter') {
      if (allResults[selectedIndex]) {
        handleAction(allResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
      <div className="command-palette-container" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <Search className="search-icon" size={20} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="kbd-shortcut">ESC</div>
        </div>

        <div className="command-palette-body">
          {allResults.length === 0 ? (
            <div className="no-results">No results found for "{search}"</div>
          ) : (
            <div className="results-list">
              {['Pages', 'Documents'].map(category => {
                const items = allResults.filter(item => item.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category} className="result-category">
                    <h3 className="category-title">{category}</h3>
                    {items.map((item) => {
                      const actualIndex = allResults.indexOf(item);
                      const isSelected = selectedIndex === actualIndex;
                      return (
                        <div
                          key={item.id}
                          className={`result-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleAction(item)}
                          onMouseEnter={() => setSelectedIndex(actualIndex)}
                        >
                          <div className="item-icon">{item.icon}</div>
                          <div className="item-title">{item.title}</div>
                          {isSelected && <ArrowRight size={14} className="item-arrow" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="command-palette-footer">
          <div className="footer-tip">
            <span className="kbd">↑↓</span> to navigate
            <span className="kbd ml-4">ENTER</span> to select
            <span className="kbd ml-4">ESC</span> to close
          </div>
          <div className="footer-brand">
            <Command size={14} /> Shiro Command
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
